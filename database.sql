-- ============================================
-- SCHEMA PADRONIZADO
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =======================
-- EMPRESA (company)
-- =======================
CREATE TABLE public.company (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text UNIQUE,
  address text,
  phone text,
  email text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =======================
-- UNIDADE (unit)
-- =======================
CREATE TABLE public.unit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =======================
-- FUNCIONÁRIO (employee)
-- =======================
CREATE TABLE public.employee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.unit(id) ON DELETE SET NULL,
  name text NOT NULL,
  cpf text UNIQUE,
  employee_type smallint,
  wa_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =======================
-- VEÍCULO (vehicle)
-- =======================
CREATE TABLE public.vehicle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.unit(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employee(id) ON DELETE SET NULL,
  plate text NOT NULL UNIQUE,
  company_relation smallint,
  whatsapp_type smallint,
  model text,
  brand text,
  year integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =======================
-- MANIFESTO (manifest)
-- =======================
CREATE TABLE public.manifest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.unit(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicle(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employee(id) ON DELETE SET NULL,
  erp_code text,
  manifest_date date,
  manifest_type smallint,
  status smallint,
  processing_status smallint,
  erp_note text,
  manifest_hash text,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =======================
-- TAREFA (task)
-- =======================
CREATE TABLE public.task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.unit(id) ON DELETE SET NULL,
  manifest_id uuid REFERENCES public.manifest(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employee(id) ON DELETE SET NULL,
  erp_code text,
  task_type smallint,
  notes text,
  erp_status smallint,
  processing_status smallint,
  priority smallint,
  address text,
  latitude numeric,
  longitude numeric,
  window_start timestamptz,
  window_end timestamptz,
  order_expected integer,
  order_completed integer,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =======================
-- HISTÓRICO DE TAREFA (task_history)
-- =======================
CREATE TABLE public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.task(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employee(id) ON DELETE SET NULL,
  business_status smallint,
  technical_status smallint,
  notes text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- =======================
-- OCORRÊNCIA (incident)
-- =======================
CREATE TABLE public.incident (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_code text,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =======================
-- NOTA FISCAL (invoice)
-- =======================
CREATE TABLE public.invoice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE,
  manifest_id uuid REFERENCES public.manifest(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.task(id) ON DELETE CASCADE,
  number text,
  sender_id uuid,
  recipient_name text,
  recipient_document text,
  recipient_address text,
  recipient_phone text,
  value numeric,
  volumes integer,
  weight numeric,
  cubic_meters numeric,
  invoice_type smallint,
  expected_date date,
  window_start timestamptz,
  window_end timestamptz,
  erp_note text,
  erp_incident smallint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =======================
-- IMAGEM (image)
-- =======================
CREATE TABLE public.image (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.task(id) ON DELETE CASCADE,
  manifest_id uuid REFERENCES public.manifest(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoice(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.incident(id) ON DELETE CASCADE,
  url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- =======================
-- LOG JSON (log_json)
-- =======================
CREATE TABLE public.log_json (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_id text,
  content jsonb,
  log_type smallint,
  created_at timestamptz DEFAULT now()
);

-- =======================
-- WHATSAPP SESSION (wa_session)
-- =======================
CREATE TABLE public.wa_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL UNIQUE,
  employee_id uuid REFERENCES public.employee(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'start',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  retries smallint DEFAULT 0,
  last_message_id text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =======================
-- ÍNDICES
-- =======================
CREATE INDEX idx_task_manifest ON public.task (manifest_id);
CREATE INDEX idx_task_company ON public.task (company_id);
CREATE INDEX idx_manifest_vehicle ON public.manifest (vehicle_id);
CREATE INDEX idx_wa_session_wa_id ON public.wa_session (wa_id);
CREATE INDEX idx_wa_session_employee ON public.wa_session (employee_id);
CREATE INDEX idx_wa_session_context ON public.wa_session USING gin (context);

-- ============================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================

-- Ativa RLS em todas as tabelas
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);
  END LOOP;
END$$;

-- Libera acesso público (anônimo) às tabelas via API
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('CREATE POLICY "public_select_%I" ON public.%I FOR SELECT USING (true);', t.tablename, t.tablename);
    EXECUTE format('CREATE POLICY "public_insert_%I" ON public.%I FOR INSERT WITH CHECK (true);', t.tablename, t.tablename);
    EXECUTE format('CREATE POLICY "public_update_%I" ON public.%I FOR UPDATE USING (true);', t.tablename, t.tablename);
  END LOOP;
END$$;

-- (Opcional) permitir DELETE apenas com service_role
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('CREATE POLICY "admin_delete_%I" ON public.%I FOR DELETE USING (auth.role() = ''service_role'');', t.tablename, t.tablename);
  END LOOP;
END$$;
