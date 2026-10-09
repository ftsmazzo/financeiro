CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessoes (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessoes_user_idx ON public.sessoes(user_id);

CREATE TABLE IF NOT EXISTS public.config (
  user_id uuid PRIMARY KEY,
  base_data date,
  anos_projecao int NOT NULL DEFAULT 5 CHECK (anos_projecao >= 5 AND anos_projecao <= 30),
  incluir_restante boolean NOT NULL DEFAULT true,
  reajuste_mes int NOT NULL DEFAULT 1 CHECK (reajuste_mes BETWEEN 1 AND 12),
  indice_padrao_entradas numeric NOT NULL DEFAULT 5,
  indice_padrao_saidas numeric NOT NULL DEFAULT 5,
  regras_categoria jsonb NOT NULL DEFAULT '{}'::jsonb,
  regras_item jsonb NOT NULL DEFAULT '{}'::jsonb,
  dre_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  carteira_listas jsonb NOT NULL DEFAULT '{}'::jsonb,
  premissas jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  codigo text,
  empresa text NOT NULL,
  carteira text,
  dia integer,
  banco text,
  ativo boolean NOT NULL DEFAULT true,
  regime text,
  grupo text,
  setor text,
  valor numeric(18,6) NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','import')),
  created_at timestamptz NOT NULL DEFAULT now(),
  inicio text,
  fim text,
  valores_base jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS entradas_user_idx ON public.entradas(user_id);

CREATE TABLE IF NOT EXISTS public.saidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  descricao text NOT NULL,
  categoria text,
  pgto text,
  banco text,
  dia integer,
  destino text CHECK (destino IN ('ESCRITORIO','PESSOAL')),
  valores_mes jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor_fixo numeric(18,6),
  ri text,
  rf text,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','import')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saidas_user_idx ON public.saidas(user_id);

CREATE TABLE IF NOT EXISTS public.entradas_pessoais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  descricao text NOT NULL,
  dia integer,
  banco text,
  inicio text,
  fim text,
  valor numeric(18,6) NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','import')),
  created_at timestamptz NOT NULL DEFAULT now(),
  valores_base jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS entradas_pessoais_user_idx ON public.entradas_pessoais(user_id);

CREATE TABLE IF NOT EXISTS public.saldos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  banco text NOT NULL,
  saldo numeric NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, banco)
);

CREATE TABLE IF NOT EXISTS public.baixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada','pessoal','saida')),
  item_id uuid NOT NULL,
  mes text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  banco text,
  baixado_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo, item_id, mes)
);
CREATE INDEX IF NOT EXISTS baixas_user_mes ON public.baixas (user_id, mes);

CREATE TABLE IF NOT EXISTS public.investimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'Aplicação',
  instituicao text,
  destino text,
  saldo_inicial numeric NOT NULL DEFAULT 0,
  taxa numeric NOT NULL DEFAULT 0,
  aporte_fixo numeric NOT NULL DEFAULT 0,
  saida_id uuid,
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS investimentos_user_idx ON public.investimentos(user_id);

CREATE TABLE IF NOT EXISTS public.bens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text,
  valor numeric NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  destino text
);
CREATE INDEX IF NOT EXISTS bens_user_idx ON public.bens(user_id);

CREATE TABLE IF NOT EXISTS public.dividas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  credor text,
  saldo numeric NOT NULL DEFAULT 0,
  juros numeric NOT NULL DEFAULT 0,
  parcela_fixa numeric NOT NULL DEFAULT 0,
  saida_id uuid,
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  tipo text,
  destino text
);
CREATE INDEX IF NOT EXISTS dividas_user_idx ON public.dividas(user_id);

CREATE TABLE IF NOT EXISTS public.carteira (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  classe text NOT NULL DEFAULT 'Renda fixa',
  subcategoria text NOT NULL DEFAULT 'CDB',
  instituicao text,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade text,
  valor_investido numeric NOT NULL DEFAULT 0,
  valor_atual numeric NOT NULL DEFAULT 0,
  data_aplicacao date,
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS carteira_user_idx ON public.carteira(user_id);
