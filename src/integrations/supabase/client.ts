import { consultar, criarConta, entrar, eu, sair } from "@/lib/conta.functions";

type Filtro =
  | { t: "eq"; col: string; val?: unknown }
  | { t: "in"; col: string; val?: unknown }
  | { t: "notnull"; col: string };

type Estado = {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  columns: string | null;
  order: string | null;
  filters: Filtro[];
  values?: unknown;
  onConflict: string | null;
  single: "none" | "maybe" | "one";
  returning: boolean;
};

type Linha = {
  id: any; user_id: any; base_data: any; anos_projecao: any; incluir_restante: any; reajuste_mes: any;
  indice_padrao_entradas: any; indice_padrao_saidas: any; regras_categoria: any; regras_item: any; dre_map: any;
  updated_at: any; carteira_listas: any; premissas: any; codigo: any; empresa: any; carteira: any; dia: any;
  banco: any; ativo: any; regime: any; grupo: any; setor: any; valor: any; origem: any; created_at: any;
  inicio: any; fim: any; valores_base: any; descricao: any; categoria: any; pgto: any; destino: any;
  valores_mes: any; valor_fixo: any; ri: any; rf: any; saldo: any; atualizado_em: any; tipo: any; item_id: any;
  mes: any; baixado_em: any; nome: any; instituicao: any; saldo_inicial: any; taxa: any; aporte_fixo: any;
  saida_id: any; credor: any; juros: any; parcela_fixa: any; classe: any; subcategoria: any; quantidade: any;
  unidade: any; valor_investido: any; valor_atual: any; data_aplicacao: any;
};
type Resposta<T> = { data: T; error: { message: string } | null };
type Ouvinte = (evento: "SIGNED_IN" | "SIGNED_OUT") => void;

function executar(estado: Estado): Promise<Resposta<any>> {
  return consultar({ data: estado }) as Promise<Resposta<any>>;
}
const ouvintes = new Set<Ouvinte>();

function avisar(evento: "SIGNED_IN" | "SIGNED_OUT") {
  for (const ouvinte of ouvintes) ouvinte(evento);
}

function respostaDe<T>(estado: Estado) {
  return {
    then<TResult1 = Resposta<T>, TResult2 = never>(
      resolve?: ((value: Resposta<T>) => TResult1 | PromiseLike<TResult1>) | null,
      reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return executar(estado).then(resolve as (value: Resposta<any>) => TResult1 | PromiseLike<TResult1>, reject);
    },
  };
}

function consulta(table: string) {
  const estado: Estado = {
    table,
    op: "select",
    columns: null,
    order: null,
    filters: [],
    onConflict: null,
    single: "none",
    returning: false,
  };
  const self = {
    select(cols?: string) {
      if (estado.op === "select") estado.columns = cols ?? "*";
      else estado.returning = true;
      return self;
    },
    order(col: string) {
      estado.order = col;
      return self;
    },
    eq(col: string, val: unknown) {
      estado.filters.push({ t: "eq", col, val });
      return self;
    },
    in(col: string, val: unknown[]) {
      estado.filters.push({ t: "in", col, val });
      return self;
    },
    not(col: string, op: string, val: unknown) {
      if (op === "is" && val === null) estado.filters.push({ t: "notnull", col });
      return self;
    },
    insert(values: unknown) {
      estado.op = "insert";
      estado.values = values;
      return self;
    },
    update(values: unknown) {
      estado.op = "update";
      estado.values = values;
      return self;
    },
    delete() {
      estado.op = "delete";
      return self;
    },
    upsert(values: unknown, opts?: { onConflict?: string }) {
      estado.op = "upsert";
      estado.values = values;
      estado.onConflict = opts?.onConflict ?? null;
      return self;
    },
    maybeSingle() {
      estado.single = "maybe";
      return respostaDe<Linha | null>(estado);
    },
    single() {
      estado.single = "one";
      return respostaDe<Linha>(estado);
    },
    then<TResult1 = Resposta<Linha[] | null>, TResult2 = never>(
      resolve?: ((value: Resposta<Linha[] | null>) => TResult1 | PromiseLike<TResult1>) | null,
      reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return executar(estado).then(resolve as (value: Resposta<any>) => TResult1 | PromiseLike<TResult1>, reject);
    },
  };
  return self;
}

export const supabase = {
  from: consulta,
  auth: {
    async getUser() {
      try {
        const user = await eu();
        return { data: { user }, error: null as null };
      } catch (error) {
        return { data: { user: null }, error };
      }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const resposta = await entrar({ data: { email, senha: password } });
      if (resposta.error) return { error: { message: resposta.error } };
      avisar("SIGNED_IN");
      return { error: null };
    },
    async signUp({ email, password }: { email: string; password: string; options?: { emailRedirectTo?: string } }) {
      const resposta = await criarConta({ data: { email, senha: password } });
      if (resposta.error) return { error: { message: resposta.error } };
      avisar("SIGNED_IN");
      return { error: null };
    },
    async signOut() {
      await sair();
      avisar("SIGNED_OUT");
    },
    onAuthStateChange(callback: (evento: string) => void) {
      const ouvinte: Ouvinte = (evento) => callback(evento);
      ouvintes.add(ouvinte);
      return { data: { subscription: { unsubscribe() { ouvintes.delete(ouvinte); } } } };
    },
    async getSession() {
      return { data: { session: null as { access_token?: string } | null } };
    },
  },
};
