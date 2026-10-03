"""Data contracts for the tables that leave Snowflake for the agent's operational store.

One pydantic model per exported table (CLEAN.agent_*). The loader validates every row against these
models before loading it; a row that fails is reported, never silently dropped or repaired.
The rules mirror pipelines/snowflake/03_clean.sql and the evidence in docs/profile_core.md.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Currency = Literal["USD", "COP", "ARS", "MXN"]
Country = Literal["México", "Colombia", "Argentina"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    # dq_flags travel as a comma-separated string; empty means no known gap
    dq_flags: Optional[str] = None


class AgentCustomer(BaseModel):
    """Card holders only. No identity document, birth date, contact data, income or credit score."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    customer_id: str = Field(min_length=1)
    first_name: Optional[str] = None
    country: Country
    segment: Optional[str] = None
    customer_status: Literal["Active", "Inactive", "Suspended", "Closed"]


class AgentCard(Contract):
    """Credit and debit cards. The full card number never leaves Snowflake: only its last 4 digits."""
    product_id: str = Field(min_length=1)
    customer_id: str = Field(min_length=1)
    product_category: Literal["credit_card", "debit_card"]
    product_type: str
    card_last4: Optional[str] = Field(default=None, pattern=r"^\d{4}$")
    currency: Currency
    current_balance: Optional[Decimal] = Field(default=None, ge=0)
    credit_limit: Optional[Decimal] = Field(default=None, ge=0)
    product_status: Literal["Active", "Closed", "Blocked", "Suspended"]
    opening_date: Optional[date] = None
    expiration_date: Optional[date] = None
    has_linked_app: Optional[bool] = None
    days_past_due: Optional[float] = Field(default=None, ge=0)
    last_transaction_date: Optional[datetime] = None

    @model_validator(mode="after")
    def expiration_after_opening(self):
        if self.opening_date and self.expiration_date and self.expiration_date < self.opening_date:
            raise ValueError("expiration_date is before opening_date")
        return self


class AgentTransaction(Contract):
    """Card transactions in the export window. amount_usd_method says how amount_usd was obtained."""
    transaction_id: str = Field(min_length=1)
    transaction_date: datetime
    product_id: str = Field(min_length=1)
    customer_id: str = Field(min_length=1)
    transaction_type: str
    transaction_category: Optional[str] = None
    amount: Decimal = Field(gt=0)
    currency: Currency
    amount_usd: Optional[Decimal] = Field(default=None, gt=0)
    amount_usd_method: Optional[Literal["source", "usd_identity", "recomputed_source_rate"]] = None
    channel: Optional[str] = None
    merchant_name: Optional[str] = None
    merchant_category: Optional[str] = None
    transaction_country: Optional[str] = None
    transaction_city: Optional[str] = None
    transaction_status: Literal["Approved", "Declined", "Pending", "Reversed"]
    response_code: Optional[str] = None
    is_fraud: Optional[bool] = None
    fraud_score: Optional[float] = Field(default=None, ge=0, le=100)

    @field_validator("transaction_country")
    @classmethod
    def country_normalized(cls, value):
        if value == "Mexico":
            raise ValueError("country must be normalized to 'México'")
        return value


class AgentComplaint(Contract):
    """Complaints of card holders. Not exported: the template description text and affected_product_id,
    which in the source always points to another customer's product."""
    complaint_id: str = Field(min_length=1)
    creation_date: datetime
    customer_id: str = Field(min_length=1)
    case_type: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    reception_channel: Optional[str] = None
    claimed_amount: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[Currency] = None
    priority: Optional[str] = None
    status: Literal["In Process", "Open", "Resolved", "Escalated", "Closed", "Rejected"]
    first_response_date: Optional[datetime] = None
    resolution_date: Optional[datetime] = None
    sla_breached: Optional[bool] = None
    resolution_days: Optional[float] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def resolution_after_creation(self):
        if self.resolution_date and self.resolution_date < self.creation_date:
            raise ValueError("resolution_date is before creation_date")
        return self


CONTRACTS = {
    "agent_customers": AgentCustomer,
    "agent_cards": AgentCard,
    "agent_transactions": AgentTransaction,
    "agent_complaints": AgentComplaint,
}
