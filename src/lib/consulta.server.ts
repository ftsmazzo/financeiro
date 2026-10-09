import { db, serializar } from "./pg.server";

type Filtro =
  | { t: "eq"; col: string; val?: unknown }
  | { t: "in"; col: string; val?: unknown }
  | { t: "notnull"; col: string };

export type PedidoConsulta = {
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

const TABELAS: Record<string, { cols: string[]; conflito: string[][] }> = {
  config: {
    cols: ["user_id", "base_data", "anos_projecao", "incluir_restante", "reajuste_mes", "indice_padrao_entradas", "indice_padrao_saidas", "regras_categoria", "regras_item", "dre_map", "updated_at", "carteira_listas", "premissas"],
    conflito: [["user_id"]],
  },
  entradas: {
    cols: ["id", "user_id", "codigo", "empresa", "carteira", "dia", "banco", "ativo", "regime", "grupo", "setor", "valor", "origem", "created_at", "inicio", "fim", "valores_base"],
    conflito: [["id"]],
  },
  saidas: {
    cols: ["id", "user_id", "descricao", "categoria", "pgto", "banco", "dia", "destino", "valores_mes", "valor_fixo", "ri", "rf", "origem", "created_at"],
    conflito: [["id"]],
  },
  entradas_pessoais: {
    cols: ["id", "user_id", "descricao", "dia", "banco", "inicio", "fim", "valor", "origem", "created_at", "valores_base"],
    conflito: [["id"]],
  },
  saldos: {
    cols: ["id", "user_id", "banco", "saldo", "atualizado_em", "origem", "created_at"],
    conflito: [["user_id", "banco"], ["id"]],
  },
  baixas: {
    cols: ["id", "user_id", "tipo", "item_id", "mes", "valor", "banco", "baixado_em", "origem", "created_at"],
    conflito: [["user_id", "tipo", "item_id", "mes"], ["id"]],
  },
  investimentos: {
    cols: ["id", "user_id", "nome", "tipo", "instituicao", "destino", "saldo_inicial", "taxa", "aporte_fixo", "saida_id", "origem", "created_at"],
    conflito: [["id"]],
  },
  bens: {
    cols: ["id", "user_id", "nome", "tipo", "valor", "origem", "created_at", "destino"],
    conflito: [["id"]],
  },
  dividas: {
    cols: ["id", "user_id", "nome", "credor", "saldo", "juros", "parcela_fixa", "saida_id", "origem", "created_at", "tipo", "destino"],
    conflito: [["id"]],
  },
  carteira: {
    cols: ["id", "user_id", "nome", "classe", "subcategoria", "instituicao", "quantidade", "unidade", "valor_investido", "valor_atual", "data_aplicacao", "origem", "created_at"],
    conflito: [["id"]],
  },
};

function tabelaDe(nome: string) {
  const tabela = TABELAS[nome];
  if (!tabela) throw new Error("Tabela não permitida");
  return tabela;
}

function colunaDe(tabela: { cols: string[] }, col: string) {
  if (!tabela.cols.includes(col)) throw new Error("Coluna não permitida");
  return col;
}

function linhasDe(values: unknown, userId: string, cols: string[]) {
  const lista = Array.isArray(values) ? values : [values];
  if (lista.length === 0) return [];
  if (lista.length > 500) throw new Error("Lote maior que 500 linhas");
  return lista.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Linha inválida");
    const origem = item as Record<string, unknown>;
    const linha: Record<string, unknown> = { user_id: userId };
    for (const [chave, valor] of Object.entries(origem)) {
      if (chave === "user_id") continue;
      if (!cols.includes(chave)) throw new Error("Coluna não permitida");
      linha[chave] = valor;
    }
    return linha;
  });
}

function onde(sql: ReturnType<typeof db>, userId: string, filters: Filtro[], cols: string[]) {
  const partes: any[] = [sql`user_id = ${userId}`];
  for (const filtro of filters) {
    const col = colunaDe({ cols }, filtro.col);
    if (filtro.t === "eq") partes.push(sql`${sql(col)} = ${filtro.val as any}`);
    else if (filtro.t === "notnull") partes.push(sql`${sql(col)} IS NOT NULL`);
    else if (filtro.t === "in") {
      const vals = Array.isArray(filtro.val) ? filtro.val : [];
      if (vals.length === 0) partes.push(sql`false`);
      else partes.push(sql`${sql(col)} IN ${sql(vals as any[])}`);
    }
  }
  return partes.reduce((acc, parte) => sql`${acc} AND ${parte}`);
}

function listaSql(sql: ReturnType<typeof db>, partes: any[]) {
  return partes.slice(1).reduce((acc, parte) => sql`${acc}, ${parte}`, partes[0]);
}

function colunasSelect(sql: ReturnType<typeof db>, pedido: string | null, cols: string[]) {
  if (!pedido || pedido.trim() === "*") return sql`*`;
  const nomes = pedido.split(",").map((nome) => colunaDe({ cols }, nome.trim()));
  return listaSql(sql, nomes.map((nome) => sql(nome)));
}

function conflitoDe(tabela: { conflito: string[][] }, pedido: string | null, linhas: Record<string, unknown>[]) {
  if (pedido) {
    const cols = pedido.split(",").map((nome) => nome.trim());
    const ok = tabela.conflito.some((alvo) => alvo.length === cols.length && alvo.every((col, i) => col === cols[i]));
    if (!ok) throw new Error("Conflito não permitido");
    return cols;
  }
  if (linhas.every((linha) => linha["id"])) return ["id"];
  const porUsuario = tabela.conflito.find((alvo) => alvo.length === 1 && alvo[0] === "user_id");
  if (porUsuario) return porUsuario;
  throw new Error("Informe a chave do conflito");
}

function forma(linhas: unknown[], single: PedidoConsulta["single"]) {
  if (single === "maybe") {
    if (linhas.length > 1) throw new Error("Mais de um registro");
    return linhas[0] ?? null;
  }
  if (single === "one") {
    if (linhas.length !== 1) throw new Error(linhas.length === 0 ? "Registro não encontrado" : "Mais de um registro");
    return linhas[0];
  }
  return linhas;
}

export async function executarConsulta(userId: string, pedido: PedidoConsulta) {
  const tabela = tabelaDe(pedido.table);
  const sql = db();
  const nome = sql(pedido.table);

  if (pedido.op === "select") {
    if (pedido.order) colunaDe(tabela, pedido.order);
    const ordem = pedido.order ? sql`ORDER BY ${sql(pedido.order)} ASC` : sql``;
    const rows = await sql`SELECT ${colunasSelect(sql, pedido.columns, tabela.cols)} FROM ${nome} WHERE ${onde(sql, userId, pedido.filters, tabela.cols)} ${ordem}`;
    return serializar(forma([...rows], pedido.single));
  }

  if (pedido.op === "delete") {
    await sql`DELETE FROM ${nome} WHERE ${onde(sql, userId, pedido.filters, tabela.cols)}`;
    return null;
  }

  if (pedido.op === "update") {
    const [linha] = linhasDe(pedido.values, userId, tabela.cols);
    if (!linha) throw new Error("Nada para atualizar");
    const chaves = Object.keys(linha).filter((chave) => chave !== "user_id" && chave !== "id");
    if (chaves.length === 0) return null;
    await sql`UPDATE ${nome} SET ${sql(linha, ...chaves)} WHERE ${onde(sql, userId, pedido.filters, tabela.cols)}`;
    return null;
  }

  const linhas = linhasDe(pedido.values, userId, tabela.cols);
  if (linhas.length === 0) return pedido.returning ? forma([], pedido.single) : null;
  const chaves = [...new Set(linhas.flatMap((linha) => Object.keys(linha)))];
  const completas = linhas.map((linha) => {
    const cheia: Record<string, unknown> = {};
    for (const chave of chaves) cheia[chave] = linha[chave] ?? null;
    return cheia;
  });

  if (pedido.op === "insert") {
    const rows = await sql`INSERT INTO ${nome} ${sql(completas, ...chaves)} RETURNING *`;
    return pedido.returning ? serializar(forma([...rows], pedido.single)) : null;
  }

  const conflito = conflitoDe(tabela, pedido.onConflict, completas);
  const atualizar = chaves.filter((chave) => !conflito.includes(chave));
  const set = atualizar.length
    ? listaSql(sql, atualizar.map((chave) => sql`${sql(chave)} = EXCLUDED.${sql(chave)}`))
    : sql`user_id = EXCLUDED.user_id`;
  const rows = await sql`
    INSERT INTO ${nome} ${sql(completas, ...chaves)}
    ON CONFLICT (${listaSql(sql, conflito.map((chave) => sql(chave)))})
    DO UPDATE SET ${set}
    RETURNING *
  `;
  return pedido.returning ? serializar(forma([...rows], pedido.single)) : null;
}
