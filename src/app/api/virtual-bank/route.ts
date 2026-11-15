import { NextResponse } from "next/server";
import {
  executeBankTransfer,
  INITIAL_BANK_BALANCE,
  INITIAL_LEDGER,
} from "@/lib/bank-service";

// shortcut: in-memory server state resets on cold start; client localStorage stays authoritative for demos
let serverBalance = INITIAL_BANK_BALANCE;
let serverLedger = [...INITIAL_LEDGER];

export async function GET() {
  return NextResponse.json({
    accountNumber: "782-2-90145-8",
    accountName: "Finora Virtual Wallet",
    balance: serverBalance,
    ledger: serverLedger,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = executeBankTransfer(
      {
        type: body.type,
        amount: Number(body.amount),
        title: String(body.title ?? ""),
        counterparty: String(body.counterparty ?? ""),
        currentBalance:
          typeof body.currentBalance === "number" ? body.currentBalance : undefined,
      },
      serverBalance
    );

    if (!result.ok || !result.entry) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    serverBalance = result.balance;
    serverLedger = [result.entry, ...serverLedger];

    return NextResponse.json({
      balance: result.balance,
      entry: result.entry,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
