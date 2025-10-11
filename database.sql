-- ==========================================
-- BANCO DE DADOS: LOGÍSTICA / BOT FARRAPOS
-- Estrutura reorganizada para leitura e manutenção
-- ==========================================

-- =========================
-- 1. EMPRESAS E UNIDADES
-- =========================

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

CREATE TABLE public.unit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id),
  name text NOT NULL,
  address text,
  phone text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =========================
-- 2. FUNCIONÁRIOS E VEÍCULOS
-- =========================

CREATE TABLE public.employee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id),
  unit_id uuid REFERENCES public.unit(id),
  name text NOT NULL,
  cpf text UNIQUE,
  employee_type smallint,
  wa_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.vehicle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id),
  unit_id uuid REFERENCES public.unit(id),
  employee_id uuid REFERENCES public.employee(id),
  plate text NOT NULL UNIQUE,
  model text,
  brand text,
  year integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =========================
-- 3. MANIFESTOS E TAREFAS
-- =========================

CREATE TABLE public.manifest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id),
  unit_id uuid REFERENCES public.unit(id),
  vehicle_id uuid REFERENCES public.vehicle(id),
  employee_id uuid REFERENCES public.employee(id),
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

CREATE TABLE public.task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id),
  unit_id uuid REFERENCES public.unit(id),
  manifest_id uuid REFERENCES public.manifest(id),
  employee_id uuid REFERENCES public.employee(id),
  erp_code text,
  task_type smallint,
  notes text,
  task_status smallint,
  processing_status smallint,
  priority smallint,
  address text,
  latitude numeric,
  longitude numeric,
  window_start timestamptz,
  window_end timestamptz,
  order_expected integer,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.task(id),
  employee_id uuid REFERENCES public.employee(id),
  business_status smallint,
  technical_status smallint,
  notes text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- =========================
-- 4. DOCUMENTOS E EVIDÊNCIAS
-- =========================

CREATE TABLE public.invoice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.company(id),
  manifest_id uuid REFERENCES public.manifest(id),
  task_id uuid REFERENCES public.task(id),
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

CREATE TABLE public.incident (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_code text,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.image (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.task(id),
  manifest_id uuid REFERENCES public.manifest(id),
  invoice_id uuid REFERENCES public.invoice(id),
  incident_id uuid REFERENCES public.incident(id),
  url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- =========================
-- 5. LOGS E CONTROLE DE SESSÃO
-- =========================

CREATE TABLE public.log_json (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text,
  content jsonb,
  log_type text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.wa_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id text NOT NULL UNIQUE,
  employee_id uuid REFERENCES public.employee(id),
  state text NOT NULL DEFAULT 'start',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  retries smallint DEFAULT 0,
  last_message_id text,
  active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  task_id uuid REFERENCES public.task(id)
);
