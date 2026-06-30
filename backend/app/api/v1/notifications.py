"""Notification routes."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_user as get_current_user_from_token
from app.data_store import NOTIFICATIONS

router = APIRouter()

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    is_read: bool
    created_at: str

@router.get("/")
async def list_notifications(
    unread_only: Optional[bool] = None,
    user: dict = Depends(get_current_user_from_token)
):
    """List notifications for the current user."""
    results = []
    for n in NOTIFICATIONS.values():
        if n["user_id"] != user["id"]:
            continue
        if unread_only is not None and n["is_read"] == unread_only:
            continue
        results.append(n)
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return {"status": "success", "notifications": results}

@router.put("/{notification_id}/read")
async def mark_read(notification_id: str, user: dict = Depends(get_current_user_from_token)):
    """Mark a notification as read."""
    if notification_id not in NOTIFICATIONS:
        raise HTTPException(status_code=404, detail="Notification not found")
    NOTIFICATIONS[notification_id]["is_read"] = True
    return {"status": "success", "notification": NOTIFICATIONS[notification_id]}

@router.put("/read-all")
async def mark_all_read(user: dict = Depends(get_current_user_from_token)):
    """Mark all notifications as read."""
    for n in NOTIFICATIONS.values():
        if n["user_id"] == user["id"]:
            n["is_read"] = True
    return {"status": "success", "message": "All notifications marked as read"}
