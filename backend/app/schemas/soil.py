from typing import Literal, Optional
from pydantic import BaseModel, Field

Source = Literal["measured", "estimated"]


class SoilInput(BaseModel):
    """All soil fields are optional so partial data can be screened; the ML model needs all 7."""
    N: Optional[float] = Field(None, ge=0, le=300)
    P: Optional[float] = Field(None, ge=0, le=300)
    K: Optional[float] = Field(None, ge=0, le=400)
    ph: Optional[float] = Field(None, ge=3, le=10)
    temperature: Optional[float] = Field(None, ge=0, le=50, description="deg C")
    humidity: Optional[float] = Field(None, ge=0, le=100, description="%")
    rainfall: Optional[float] = Field(None, ge=0, le=500, description="mm")
    npk_unit: Literal["dataset_scale", "kg_per_ha"] = "dataset_scale"
    location: Optional[str] = Field(None, max_length=120)
    farming_context: Optional[str] = Field(None, max_length=300)
    value_sources: dict[str, Source] = Field(default_factory=dict)
    input_source: Literal["manual", "report"] = "manual"
    report_metadata: Optional[dict] = None
    save: bool = True


class CropInput(BaseModel):
    N: float = Field(..., ge=0, le=300)
    P: float = Field(..., ge=0, le=300)
    K: float = Field(..., ge=0, le=400)
    ph: float = Field(..., ge=3, le=10)
    temperature: float = Field(..., ge=0, le=50)
    humidity: float = Field(..., ge=0, le=100)
    rainfall: float = Field(..., ge=0, le=500)
