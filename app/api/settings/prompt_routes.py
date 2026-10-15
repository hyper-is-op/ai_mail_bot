"""
app/api/settings/prompt_routes.py

REST API endpoints for inspecting, updating, and resetting configurable
system prompts for client accounts.
"""

import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth_deps import get_current_user
from app.prompt_service import (
    list_prompts_for_client,
    save_client_prompt,
    reset_client_prompt,
    reset_all_client_prompts,
)
from app.prompt_defaults import PROMPT_DEFINITIONS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings/prompts", tags=["Prompt Settings"])


class PromptUpdateRequest(BaseModel):
    prompt_text: str = Field(..., description="The customized prompt template string.")


@router.get("", response_model=List[Dict[str, Any]])
def get_prompts_endpoint(user: dict = Depends(get_current_user)):
    """
    List all 11 system prompts, their variable definitions, active text, and whether custom.
    """
    client_id = user.get("client_id")
    try:
        return list_prompts_for_client(client_id)
    except Exception as e:
        logger.error(f"❌ Failed to fetch prompts for client '{client_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not retrieve prompts: {str(e)}"
        )


@router.put("/{prompt_key}")
def update_prompt_endpoint(
    prompt_key: str,
    payload: PromptUpdateRequest,
    user: dict = Depends(get_current_user)
):
    """
    Save or update a custom prompt override for the client.
    """
    client_id = user.get("client_id")
    if prompt_key not in PROMPT_DEFINITIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt key '{prompt_key}' does not exist in registry."
        )

    try:
        save_client_prompt(client_id, prompt_key, payload.prompt_text)
        return {"success": True, "message": f"Prompt '{prompt_key}' updated successfully."}
    except Exception as e:
        logger.error(f"❌ Failed to save prompt '{prompt_key}' for client '{client_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update prompt: {str(e)}"
        )


@router.post("/{prompt_key}/reset")
def reset_prompt_endpoint(
    prompt_key: str,
    user: dict = Depends(get_current_user)
):
    """
    Reset a single prompt to codebase default by removing client override.
    """
    client_id = user.get("client_id")
    if prompt_key not in PROMPT_DEFINITIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prompt key '{prompt_key}' does not exist in registry."
        )

    try:
        reset_client_prompt(client_id, prompt_key)
        return {"success": True, "message": f"Prompt '{prompt_key}' reset to factory default."}
    except Exception as e:
        logger.error(f"❌ Failed to reset prompt '{prompt_key}' for client '{client_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset prompt: {str(e)}"
        )


@router.post("/reset-all")
def reset_all_prompts_endpoint(user: dict = Depends(get_current_user)):
    """
    Reset ALL prompts for this client to factory defaults.
    """
    client_id = user.get("client_id")
    try:
        reset_all_client_prompts(client_id)
        return {"success": True, "message": "All prompts successfully reset to factory defaults."}
    except Exception as e:
        logger.error(f"❌ Failed to reset all prompts for client '{client_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset all prompts: {str(e)}"
        )
