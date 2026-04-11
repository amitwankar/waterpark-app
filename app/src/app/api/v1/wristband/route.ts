import { NextRequest, NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { message: "Wristband module is not enabled in current schema" },
    { status: 501 },
  );
}

export async function POST(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { message: "Wristband module is not enabled in current schema" },
    { status: 501 },
  );
}
