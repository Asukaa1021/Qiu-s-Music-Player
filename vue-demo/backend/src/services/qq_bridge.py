"""本地 QQ 音乐认证桥接服务。

Node 后端只与此服务的本机地址通信；QQ Music 凭据不会下发到浏览器。
"""

from __future__ import annotations

import base64
import asyncio
import uuid
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from qqmusic_api import Client
from qqmusic_api.models.login import QRLoginType
from qqmusic_api.models.request import Credential


app = FastAPI()
sessions: dict[str, dict[str, Any]] = {}


class CredentialPayload(BaseModel):
    credential: dict[str, Any]


def as_credential(value: dict[str, Any]) -> Credential:
    try:
        return Credential.model_validate(value)
    except Exception as exc:
        raise HTTPException(401, "QQ 音乐登录凭据无效") from exc


def song_json(song: Any) -> dict[str, Any]:
    return {
        "id": song.mid,
        "name": song.title or song.name,
        "artist": "/".join(item.name or item.title for item in song.singer),
        "album": song.album.name or song.album.title,
        "cover": song.cover_url(),
        "source": "qq",
    }


def is_free_to_play(song: Any) -> bool:
    """仅保留 QQ 明确标记为无需会员播放的歌曲。

    部分免费曲不返回 size_128mp3，不能再以该字段作为过滤条件。
    """
    return song.pay.pay_play == 0


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/qr")
async def create_qr() -> dict[str, str]:
    client = Client()
    qr = await client.login.get_qrcode(QRLoginType.MOBILE)
    session_id = str(uuid.uuid4())
    session = {"client": client, "qr": qr, "status": "waiting", "credential": None}
    sessions[session_id] = session

    async def listen_login() -> None:
        try:
            # QQ 音乐 App 的二维码通过 MQTT 推送确认，不能套用网页二维码的 HTTP 轮询。
            async for result in client.login.checking_mobile_qrcode(qr):
                session["status"] = result.event.name.lower()
                if result.done and result.credential:
                    session["credential"] = result.credential.model_dump(by_alias=True)
                    break
        except Exception as exc:
            session["status"] = "error"
            session["error"] = str(exc)
        finally:
            await client.close()

    session["task"] = asyncio.create_task(listen_login())
    return {
        "sessionId": session_id,
        "image": "data:%s;base64,%s" % (qr.mimetype, base64.b64encode(qr.data).decode()),
    }


@app.get("/qr/{session_id}")
async def check_qr(session_id: str) -> dict[str, Any]:
    session = sessions.get(session_id)
    if session is None:
        raise HTTPException(404, "二维码会话已失效，请重新获取")
    status = session["status"]
    if status == "done" and session["credential"]:
        sessions.pop(session_id, None)
        return {"status": "done", "credential": session["credential"]}
    if status in {"timeout", "refuse", "error"}:
        sessions.pop(session_id, None)
    return {"status": status, "error": session.get("error", "")}


@app.post("/validate")
async def validate(payload: CredentialPayload) -> dict[str, bool]:
    credential = as_credential(payload.credential)
    try:
        async with Client(credential) as client:
            return {"loggedIn": not await client.login.check_expired(credential)}
    except Exception:
        return {"loggedIn": False}


@app.post("/profile")
async def profile(payload: CredentialPayload) -> dict[str, Any]:
    credential = as_credential(payload.credential)
    try:
        async with Client(credential) as client:
            nickname = str(credential.musicid or "QQ 用户")
            avatar = ""
            vip = False
            try:
                gene = await client.user.get_music_gene(credential.encrypt_uin, credential=credential)
                nickname = gene.user_info_card.nick_name or nickname
                avatar = gene.user_info_card.head_url or ""
            except Exception:
                pass
            try:
                vip_info = await client.user.get_vip_info(credential=credential)
                vip = bool(vip_info.svip or vip_info.star or vip_info.identity.vip or vip_info.identity.huge_vip)
            except Exception:
                pass
            return {"platform": "qq", "nickname": nickname, "avatar": avatar, "vip": vip}
    except Exception as exc:
        raise HTTPException(502, f"QQ 音乐资料获取失败：{exc}") from exc


@app.post("/daily")
async def daily(payload: CredentialPayload) -> dict[str, Any]:
    credential = as_credential(payload.credential)
    try:
        async with Client(credential) as client:
            result = await client.recommend.get_guess_recommend(credential=credential)
            songs = [song_json(song) for song in result.songs if is_free_to_play(song)]
            if not songs:
                # “猜你喜欢”偶尔会整批都是会员曲。此时回退到 QQ 的新歌推荐，
                # 保持每日推荐与漫游都只输出可免费播放的歌，而不是返回空列表。
                fallback = await client.recommend.get_recommend_newsong()
                songs = [song_json(song) for song in fallback.songs if is_free_to_play(song)]
            if not songs:
                raise ValueError("QQ 音乐暂未返回可免费播放的推荐歌曲")
            return {"songs": songs, "total": len(songs)}
    except Exception as exc:
        raise HTTPException(502, f"QQ 音乐每日推荐获取失败：{exc}") from exc


@app.post("/fm")
async def fm(payload: CredentialPayload) -> dict[str, Any]:
    # QQ 音乐没有与网易云同名的“私人漫游”接口，使用登录后的猜你喜欢电台作为等价连续推荐。
    return await daily(payload)


@app.post("/liked")
async def liked(payload: CredentialPayload) -> dict[str, Any]:
    credential = as_credential(payload.credential)
    try:
        async with Client(credential) as client:
            result = await client.user.get_fav_song(credential.encrypt_uin, num=100, credential=credential)
            songs = [song_json(song) for song in result.songs]
            return {"songs": songs, "total": result.total or len(songs)}
    except Exception as exc:
        raise HTTPException(502, f"QQ 音乐“我喜欢”获取失败：{exc}") from exc


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3401, log_level="warning")
