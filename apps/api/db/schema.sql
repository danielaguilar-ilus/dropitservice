-- ============================================================
-- Dropit Service — PostgreSQL Schema
-- FASE 1: Foundation Layer
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM types ───────────────────────────────────────────────────────────────

CREATE TYPE request_status AS ENUM (
  'Pendiente de cotizacion',
  'Cotizado',
  'Aceptado por cliente',
  'Agendado',
  'Asignado a camion / chofer',
  'En preparacion',
  'En ruta',
  'Entregado',
  'No conforme / incidencia'
);

CREATE TYPE request_source AS ENUM (
  'formulario_cliente',
  'excel',
  'manual'
);

CREATE TYPE truck_status AS ENUM (
  'Disponible',
  'En ruta',
  'Mantencion'
);

CREATE TYPE route_status AS ENUM (
  'Agendado',
  'En ruta',
  'Completado',
  'Cancelado'
);

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin',
  'operator'
);

-- ─── users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id             VARCHAR(50)  PRIMARY KEY,
  email          VARCHAR(255) UNIQUE NOT NULL,
  name           VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           user_role    NOT NULL DEFAULT 'operator',
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── trucks ───────────────────────────────────────────────────────────────────

CREATE TABLE trucks (
  id              VARCHAR(50)  PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  plate           VARCHAR(20)  UNIQUE NOT NULL,
  max_weight_kg   INTEGER      NOT NULL DEFAULT 0,
  max_packages    INTEGER      NOT NULL DEFAULT 0,
  driver_name     VARCHAR(255),
  driver_phone    VARCHAR(30),
  status          truck_status NOT NULL DEFAULT 'Disponible',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── quote_requests ───────────────────────────────────────────────────────────

CREATE TABLE quote_requests (
  id                        VARCHAR(20)     PRIMARY KEY,
  tracking_code             VARCHAR(20)     UNIQUE NOT NULL,
  source                    request_source  NOT NULL DEFAULT 'formulario_cliente',
  customer_name             VARCHAR(255)    NOT NULL,
  customer_rut              VARCHAR(20),
  contact_person            VARCHAR(255)    NOT NULL,
  contact_phone             VARCHAR(30),
  contact_email             VARCHAR(255),
  pickup_address            TEXT            NOT NULL,
  delivery_address          TEXT            NOT NULL,
  destination_city          VARCHAR(100),
  packages                  INTEGER         NOT NULL DEFAULT 0,
  estimated_weight_kg       NUMERIC(10,2)   NOT NULL DEFAULT 0,
  cargo_description         TEXT,
  required_date             DATE,
  required_time             VARCHAR(10),
  distance_km               NUMERIC(8,2),
  estimated_price           NUMERIC(12,2),
  urgent                    BOOLEAN         NOT NULL DEFAULT false,
  observations              TEXT,
  status                    request_status  NOT NULL DEFAULT 'Pendiente de cotizacion',
  approximate_location      VARCHAR(255)    DEFAULT 'Solicitud recibida',
  has_incident              BOOLEAN         NOT NULL DEFAULT false,
  incident_description      TEXT,
  quoted_amount             NUMERIC(12,2),
  service_type              VARCHAR(255),
  internal_notes            TEXT,
  previous_quoted_amount    NUMERIC(12,2),
  peoneta_count             INTEGER         NOT NULL DEFAULT 0,
  peoneta_unit_cost         NUMERIC(10,2)   NOT NULL DEFAULT 0,
  discount                  NUMERIC(10,2)   NOT NULL DEFAULT 0,
  truck_id                  VARCHAR(50)     REFERENCES trucks(id) ON DELETE SET NULL,
  truck_name                VARCHAR(100),
  driver_name               VARCHAR(255),
  route_id                  VARCHAR(20),
  email_sent                BOOLEAN         NOT NULL DEFAULT false,
  whatsapp_sent             BOOLEAN         NOT NULL DEFAULT false,
  -- JSONB bucket for flexible/legacy fields:
  -- bultosDetail, remindersSent, quoteRevisions, photos, avioneta, avionetaCount
  raw_data                  JSONB           NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_requests_status     ON quote_requests (status);
CREATE INDEX idx_quote_requests_created_at ON quote_requests (created_at DESC);
CREATE INDEX idx_quote_requests_tracking   ON quote_requests (tracking_code);
CREATE INDEX idx_quote_requests_truck      ON quote_requests (truck_id) WHERE truck_id IS NOT NULL;
CREATE INDEX idx_quote_requests_email      ON quote_requests (contact_email);
CREATE INDEX idx_quote_requests_raw_data   ON quote_requests USING GIN (raw_data);

-- ─── routes ───────────────────────────────────────────────────────────────────

CREATE TABLE routes (
  id                    VARCHAR(20)   PRIMARY KEY,
  name                  VARCHAR(255)  NOT NULL,
  truck_id              VARCHAR(50)   REFERENCES trucks(id) ON DELETE SET NULL,
  truck_name            VARCHAR(100),
  driver_name           VARCHAR(255),
  driver_phone          VARCHAR(30),
  status                route_status  NOT NULL DEFAULT 'Agendado',
  planned_date          DATE,
  optimization_mode     VARCHAR(50)   DEFAULT 'visual_manual',
  request_ids           TEXT[]        NOT NULL DEFAULT '{}',
  ordered_request_ids   TEXT[]        NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routes_status ON routes (status);
CREATE INDEX idx_routes_truck  ON routes (truck_id) WHERE truck_id IS NOT NULL;

-- ─── notifications ────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id          VARCHAR(50)  PRIMARY KEY,
  type        VARCHAR(50)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  to_address  VARCHAR(255),
  request_id  VARCHAR(20)  REFERENCES quote_requests(id) ON DELETE SET NULL,
  payload     JSONB        NOT NULL DEFAULT '{}',
  status      VARCHAR(30)  NOT NULL DEFAULT 'simulada',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_request ON notifications (request_id);
CREATE INDEX idx_notifications_created ON notifications (created_at DESC);

-- ─── settings (key-value JSONB store) ────────────────────────────────────────

CREATE TABLE settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       JSONB        NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Sequences para IDs legacy (SOL-NNNN, DRP-NNNN, RUT-NNNN) ───────────────

CREATE SEQUENCE IF NOT EXISTS request_seq  START 1100;
CREATE SEQUENCE IF NOT EXISTS tracking_seq START 1100;
CREATE SEQUENCE IF NOT EXISTS route_seq    START 1100;

-- ─── Seed inicial de settings ────────────────────────────────────────────────

INSERT INTO settings (key, value) VALUES
  (
    'pricing',
    '{"baseFare": 12000, "pricePerKm": 950, "cargoSurcharge": {"liviana": 0, "media": 4500, "pesada": 9000}}'
  ),
  (
    'media',
    '{"loginCarousel": [], "marketingCarousel": [], "logoUrl": "/dropit-logo.jpeg", "companyName": "DropIt Service"}'
  )
ON CONFLICT DO NOTHING;
