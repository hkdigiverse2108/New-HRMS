from pydantic import BaseModel, ConfigDict
from typing import Generic, TypeVar, List

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    total: int
    page: int
    limit: int
    total_pages: int
    
    model_config = ConfigDict(populate_by_name=True)
