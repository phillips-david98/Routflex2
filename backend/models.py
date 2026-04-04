import os
from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship

from db import Base
from db_adapter import is_sqlite

USE_SPATIAL_COLUMNS = not is_sqlite()

if USE_SPATIAL_COLUMNS:
    from geoalchemy2 import Geometry


def geometry_or_text_column(geometry_type: str, srid: int = 4326):
    if USE_SPATIAL_COLUMNS:
        return Column(Geometry(geometry_type, srid=srid))
    return Column(Text)


class SessionRegion(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    name = Column(String)
    ddd = Column(String)

    customers = relationship("Customer", back_populates="session")


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    lat = Column(Float)
    lon = Column(Float)
    location = geometry_or_text_column("POINT", srid=4326)

    segmento = Column(String)
    frequencia = Column(String)
    curva = Column(String)
    tempo_atendimento = Column(Integer)

    session_id = Column(Integer, ForeignKey("sessions.id"))
    session = relationship("SessionRegion", back_populates="customers")


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    cost_per_km = Column(Float)
    autonomia_km = Column(Float)
    ev = Column(Boolean, default=False)


class ForbiddenZone(Base):
    __tablename__ = "forbidden_zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    geometry = geometry_or_text_column("POLYGON", srid=4326)


class OvernightSpot(Base):
    __tablename__ = "overnight_spots"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    lat = Column(Float)
    lon = Column(Float)
    geometry = geometry_or_text_column("POINT", srid=4326)


class AdvancedPlanHistory(Base):
    __tablename__ = "advanced_plan_history"
    id = Column(Integer, primary_key=True, index=True)
    scenario_name = Column(String, nullable=True)
    status = Column(String, nullable=False)
    selected_ddd = Column(String, nullable=True)
    customers_count = Column(Integer, default=0)
    vehicles_count = Column(Integer, default=0)
    payload_json = Column(Text, nullable=False)
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class RouteVersion(Base):
    __tablename__ = "route_versions"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True, index=True)
    version = Column(Integer, nullable=False, default=1)
    route_type = Column(String, nullable=False, index=True)
    driver_id = Column(String, nullable=True, index=True)
    customers_json = Column(Text, nullable=False)
    route_order_json = Column(Text, nullable=False)
    result_json = Column(Text, nullable=False)
    total_distance_km = Column(Float, nullable=True)
    total_time_min = Column(Float, nullable=True)
    total_cost = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    label = Column(String, nullable=True)
