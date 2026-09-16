from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.schemas.pagination import PaginatedResponse
from app.services.client import ClientService
from app.controllers.auth import get_current_employee

router = APIRouter(prefix="/clients", tags=["Clients"])

@router.post("", response_model=ClientResponse, response_model_exclude_none=True, status_code=status.HTTP_201_CREATED)
async def create_client(data: ClientCreate, current_user: dict = Depends(get_current_employee)):
    created = await ClientService.create_client(data)
    return await ClientService.get_client_by_id(created["_id"])

@router.get("", response_model=PaginatedResponse[ClientResponse], response_model_exclude_none=True)
async def get_all_clients(
    page: Optional[int] = Query(None, ge=1, description="Page number"),
    limit: Optional[int] = Query(None, ge=1, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for name, company, email, phone"),
    project_category: Optional[str] = Query(None, description="Filter clients by their projects' category"),
    is_archived: bool = Query(False, description="Set to true to get archived clients, false for active clients"),
    current_user: dict = Depends(get_current_employee)
):
    return await ClientService.get_all_clients(
        is_deleted=False, 
        is_archived=is_archived,
        search=search, 
        project_category=project_category,
        page=page, 
        limit=limit
    )

@router.get("/deleted", response_model=PaginatedResponse[ClientResponse], response_model_exclude_none=True)
async def get_deleted_clients(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1),
    current_user: dict = Depends(get_current_employee)
):
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    if role not in ["Admin", "Subadmin", "HR"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Admin/HR can view deleted clients")
        
    return await ClientService.get_all_clients(is_deleted=True, is_archived=False, page=page, limit=limit)



@router.put("/{client_id}", response_model=ClientResponse, response_model_exclude_none=True)
async def update_client(client_id: str, data: ClientUpdate, current_user: dict = Depends(get_current_employee)):
    item = await ClientService.get_client_by_id(client_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        
    updated = await ClientService.update_client(client_id, data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update client")
        
    return await ClientService.get_client_by_id(client_id)

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(client_id: str, current_user: dict = Depends(get_current_employee)):
    item = await ClientService.get_client_by_id(client_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        
    role = current_user.get("work_details", {}).get("system_role", "Employee")
    if role not in ["Admin", "Subadmin", "HR"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this client")
        
    success = await ClientService.delete_client(client_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete client")

@router.post("/{client_id}/archive", response_model=ClientResponse, response_model_exclude_none=True)
async def archive_client(client_id: str, current_user: dict = Depends(get_current_employee)):
    item = await ClientService.get_client_by_id(client_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        
    success = await ClientService.archive_client(client_id, status=True)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to archive client")
        
    return await ClientService.get_client_by_id(client_id)

@router.post("/{client_id}/unarchive", response_model=ClientResponse, response_model_exclude_none=True)
async def unarchive_client(client_id: str, current_user: dict = Depends(get_current_employee)):
    item = await ClientService.get_client_by_id(client_id)
    if not item or item.get("is_deleted"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        
    success = await ClientService.archive_client(client_id, status=False)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to unarchive client")
        
    return await ClientService.get_client_by_id(client_id)
