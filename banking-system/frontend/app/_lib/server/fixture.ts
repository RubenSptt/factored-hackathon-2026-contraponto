// Demo bank records: a clearly labeled, team-generated TEST FIXTURE.
//
// The shapes follow the stage 1 agent contracts (data-engineering/contracts/
// agent_tables.py): cards are identified by their last four digits, gaps stay
// null ("not recorded", never imputed) and fraud_score follows the dataset's
// own rule (is_fraud is a cutoff at ~35, Q07). No row comes from the hackathon
// dataset: its terms keep customer-level data out of a public repository.

export type CardType = "credit" | "debit";
export type CardStatus = "active" | "blocked" | "suspended";

export type Card = {
  card_id: string;
  customer_id: string;
  type: CardType;
  last_four: string;
  status: CardStatus;
  expiration: string; // YYYY-MM
  /** Test hook: the block tool fails on this card, to exercise retries and fallback. */
  simulate_block_failure?: boolean;
};

export type Transaction = {
  transaction_id: string;
  card_id: string;
  hours_ago: number;
  merchant: string | null; // 5% of dataset purchases have no merchant
  city: string | null;
  amount: number;
  currency: string;
  fraud_score: number | null; // 20% null in the dataset
};

export type Customer = {
  customer_id: string;
  display_name: string;
  locale: "es" | "pt";
  /** Simulated step-up verification. Not production MFA (see README). */
  security_answer: string;
};

export const FRAUD_SCORE_CUTOFF = 35; // Q07: is_fraud = fraud_score >= ~35

export const CUSTOMERS: Customer[] = [
  { customer_id: "C-1001", display_name: "Ana (2 tarjetas)", locale: "es", security_answer: "medellin" },
  { customer_id: "C-1002", display_name: "João (1 cartão)", locale: "pt", security_answer: "campinas" },
  { customer_id: "C-1003", display_name: "Lucía (falla del sistema de bloqueo)", locale: "es", security_answer: "rosario" },
  { customer_id: "C-1004", display_name: "Marta (tarjeta ya bloqueada)", locale: "es", security_answer: "cali" },
];

export const CARDS: Card[] = [
  { card_id: "K-1", customer_id: "C-1001", type: "credit", last_four: "4821", status: "active", expiration: "2028-09" },
  { card_id: "K-2", customer_id: "C-1001", type: "debit", last_four: "1290", status: "active", expiration: "2027-03" },
  { card_id: "K-3", customer_id: "C-1002", type: "credit", last_four: "7310", status: "active", expiration: "2029-01" },
  { card_id: "K-4", customer_id: "C-1003", type: "credit", last_four: "5544", status: "active", expiration: "2028-05", simulate_block_failure: true },
  { card_id: "K-5", customer_id: "C-1004", type: "debit", last_four: "6402", status: "blocked", expiration: "2027-11" },
];

export const TRANSACTIONS: Transaction[] = [
  { transaction_id: "T-9001", card_id: "K-1", hours_ago: 2, merchant: "Electrónica Express", city: "Guadalajara", amount: 2_450_000, currency: "COP", fraud_score: 87 },
  { transaction_id: "T-9002", card_id: "K-1", hours_ago: 30, merchant: "Movilidad Urbana", city: "Medellín", amount: 18_500, currency: "COP", fraud_score: 4 },
  { transaction_id: "T-9003", card_id: "K-1", hours_ago: 75, merchant: null, city: null, amount: 96_300, currency: "COP", fraud_score: null },
  { transaction_id: "T-9004", card_id: "K-2", hours_ago: 5, merchant: "Supermercado Central", city: "Medellín", amount: 152_800, currency: "COP", fraud_score: 2 },
  { transaction_id: "T-9005", card_id: "K-3", hours_ago: 3, merchant: "Livraria Paulista", city: "São Paulo", amount: 42.9, currency: "USD", fraud_score: 6 },
  { transaction_id: "T-9006", card_id: "K-3", hours_ago: 26, merchant: "Air Connect", city: "Lima", amount: 610, currency: "USD", fraud_score: 64 },
  { transaction_id: "T-9007", card_id: "K-4", hours_ago: 1, merchant: "Tienda Online 24", city: "Buenos Aires", amount: 380_000, currency: "ARS", fraud_score: 91 },
  { transaction_id: "T-9008", card_id: "K-5", hours_ago: 40, merchant: "Farmacia Norte", city: "Cali", amount: 54_000, currency: "COP", fraud_score: 3 },
];
