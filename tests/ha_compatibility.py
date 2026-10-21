"""Exercise real Home Assistant HTTP authentication, storage and timezone APIs.

Run inside the official Home Assistant 2026.10.2 container. No HA stubs.
"""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import UTC, datetime
import io
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

from aiohttp import FormData
from aiohttp.test_utils import TestClient, TestServer
from homeassistant.core import HomeAssistant
from homeassistant import auth, loader
from homeassistant.const import __version__
from homeassistant.components.http.server import HomeAssistantHTTP

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from custom_components.hassenger.media_upload import (
    HassengerMediaDownloadView, HassengerMediaUploadView,
    PRIVATE_MEDIA_PREFIX, async_migrate_media,
)
from custom_components.hassenger.store import HassengerStore
from custom_components.hassenger import _async_initialize


async def main():
    assert __version__ == "2026.10.2", __version__
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        hass = HomeAssistant(str(root))
        loader.async_setup(hass)
        hass.config.media_dirs = {"local": str(root / "media")}
        hass.auth = await auth.auth_manager_from_config(hass, [], [])
        owner = await hass.auth.async_create_user("Owner", group_ids=["system-admin"])
        member = await hass.auth.async_create_user("Member", group_ids=["system-users"])
        outsider = await hass.auth.async_create_user("Outside administrator", group_ids=["system-admin"])
        headers = {}
        for user in (owner, member, outsider):
            refresh = await hass.auth.async_create_refresh_token(user, client_id="https://hassenger.test")
            headers[user.id] = {"Authorization": "Bearer " + hass.auth.async_create_access_token(refresh)}
        server = HomeAssistantHTTP(hass, None, None, None, ["127.0.0.1"], 0, [], "modern")
        hass.http = server
        await server.async_initialize(cors_origins=[], use_x_forwarded_for=False,
                                      login_threshold=-1, is_ban_enabled=False,
                                      use_x_frame_options=True)
        # Exercise the integration's actual setup, including migration and view registration.
        assert await _async_initialize(hass)
        store = hass.data["hassenger"]["store"]
        thread = await store.create_thread("Private", [owner.id, member.id])
        thread_id = thread["id"]
        client = TestClient(TestServer(server.app))
        await client.start_server()
        try:
            def upload_form():
                form = FormData()
                form.add_field("thread_id", thread_id)
                form.add_field("file", io.BytesIO(b"GIF89a-private"), filename="private.gif", content_type="image/gif")
                return form

            response = await client.post("/api/hassenger/media/upload", data=upload_form())
            assert response.status == 401, await response.text()
            response = await client.post("/api/hassenger/media/upload", data=upload_form(), headers=headers[outsider.id])
            assert response.status == 403, await response.text()
            response = await client.post("/api/hassenger/media/upload", data=upload_form(), headers=headers[member.id])
            assert response.status == 200, await response.text()
            url = (await response.json())["media_content_id"]
            assert url.startswith(PRIVATE_MEDIA_PREFIX)
            assert (root / "hassenger" / url.rsplit("/", 1)[1]).is_file()
            assert not (root / "media" / "hassenger").exists()
            for user, status in ((None, 401), (owner, 200), (member, 200), (outsider, 403)):
                response = await client.get(url, headers=headers[user.id] if user else {})
                assert response.status == status, (user, await response.text())
                if status == 200:
                    assert await response.read() == b"GIF89a-private"
                    assert response.headers["Cache-Control"] == "no-store, private"
            # File ownership is independent of a forged message reference.
            other = await store.create_thread("Other", [outsider.id])
            await store.send_message(other["id"], outsider.id, "Outside", "", attachment={"url": url, "content_type": "image/gif"})
            response = await client.get(url, headers=headers[outsider.id])
            assert response.status == 403
            store.data["threads"][thread_id]["participants"].remove(member.id)
            response = await client.get(url, headers=headers[member.id])
            assert response.status == 403
            store.data["threads"][thread_id]["participants"].append(member.id)
            # Symlinks cannot expose another file even for an authorized member.
            filename = url.rsplit("/", 1)[1]
            private_path = root / "hassenger" / filename
            private_path.unlink()
            secret = root / "secret.txt"
            secret.write_text("secret")
            private_path.symlink_to(secret)
            response = await client.get(url, headers=headers[owner.id])
            assert response.status == 404
            private_path.unlink()

            # Legacy attachments and pictures migrate, including retry after a failed save.
            legacy = root / "media" / "hassenger"
            legacy.mkdir(parents=True)
            old_name = "a" * 32 + ".gif"
            old_file = legacy / old_name
            old_file.write_bytes(b"GIF89a-legacy")
            old_url = "media-source://media_source/local/hassenger/" + old_name
            message = await store.send_message(thread_id, owner.id, "Owner", "", attachment={"url": old_url, "content_type": "image/gif"})
            store.data["threads"][thread_id]["image"] = old_url
            orphan = legacy / ("b" * 32 + ".png")
            orphan.write_bytes(b"unreferenced")
            await store._store.async_save(store.data)
            snapshot = deepcopy(store.data)
            async def fail_save(_data):
                raise OSError("simulated full disk")
            with patch.object(store._store, "async_save", fail_save):
                try:
                    await async_migrate_media(hass, store)
                except OSError:
                    pass
                else:
                    raise AssertionError("Migration must fail if storage cannot be committed")
            assert old_file.exists() and orphan.exists()
            store.data = snapshot
            await async_migrate_media(hass, store)
            assert not old_file.exists() and not orphan.exists()
            migrated = store.data["messages"][thread_id][-1]["attachment"]["url"]
            assert migrated == store.data["threads"][thread_id]["image"]
            response = await client.get(migrated, headers=headers[member.id])
            assert response.status == 200 and await response.read() == b"GIF89a-legacy"
            response = await client.get(migrated, headers=headers[outsider.id])
            assert response.status == 403
            await async_migrate_media(hass, store)  # Idempotent after success.

            # Real timezone resolution and storage round-trip, with cold cache.
            await store.set_presence(owner.id, {"quiet_timezone": "America/New_York", "quiet_start": "22:00", "quiet_end": "07:00"})
            for bad in ("not/a/timezone", "../UTC", "/etc/passwd"):
                try:
                    await store.set_presence(owner.id, {"quiet_timezone": bad})
                except ValueError:
                    pass
                else:
                    raise AssertionError("Invalid timezone accepted")
            restored = HassengerStore(hass)
            await restored.async_load()
            assert restored.data["presence"][owner.id]["quiet_timezone"] == "America/New_York"
            assert restored.data["media"] == store.data["media"]
            with patch("custom_components.hassenger.store.datetime") as clock:
                clock.now.side_effect = lambda zone: datetime(2026, 10, 20, 3, tzinfo=UTC).astimezone(zone)
                with patch("homeassistant.util.dt.async_get_time_zone", side_effect=AssertionError("Unexpected lookup in message path")):
                    assert owner.id in restored.muted_users(thread)
            hass.data["hassenger"]["store"] = restored
            response = await client.get(migrated, headers=headers[member.id])
            assert response.status == 200
            await restored.delete_thread(thread_id)
            response = await client.get(migrated, headers=headers[member.id])
            assert response.status == 403
            print(f"Home Assistant {__version__}: setup, real HTTP authentication, member/admin isolation, revoked access, symlinks, migration retry, restart and async quiet hours passed.", flush=True)
        finally:
            await client.close()
            await hass.async_stop(force=True)


asyncio.run(main())
