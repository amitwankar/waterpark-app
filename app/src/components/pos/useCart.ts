"use client";

/**
 * useCart — useReducer-based cart engine for POS terminals.
 * Handles line items, coupon application, and payment split building.
 */

import { useReducer, useCallback } from "react";

export interface CartItem {
  id: string;         // ticketTypeId / foodItemId / etc.
  name: string;
  unitPrice: number;
  gstRate: number;    // percentage, e.g. 18
  quantity: number;
}

export interface SplitLine {
  method: "CASH" | "MANUAL_UPI" | "CARD" | "COMPLIMENTARY";
  amount: number;
}

export interface CouponState {
  code: string;
  discountAmount: number;
  description: string | null;
}

export interface CartState {
  items: CartItem[];
  coupon: CouponState | null;
  splitLines: SplitLine[];
}

type CartAction =
  | { type: "ADD_ITEM"; item: Omit<CartItem, "quantity"> }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "SET_QTY"; id: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "SET_COUPON"; coupon: CouponState }
  | { type: "CLEAR_COUPON" }
  | { type: "SET_SPLIT"; lines: SplitLine[] }
  | { type: "CLEAR_SPLIT" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { ...state, items: [...state.items, { ...action.item, quantity: 1 }] };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "SET_QTY": {
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.id !== action.id) };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.id ? { ...i, quantity: action.quantity } : i
        ),
      };
    }
    case "CLEAR":
      return { items: [], coupon: null, splitLines: [] };
    case "SET_COUPON":
      return { ...state, coupon: action.coupon };
    case "CLEAR_COUPON":
      return { ...state, coupon: null };
    case "SET_SPLIT":
      return { ...state, splitLines: action.lines };
    case "CLEAR_SPLIT":
      return { ...state, splitLines: [] };
    default:
      return state;
  }
}

const INITIAL: CartState = { items: [], coupon: null, splitLines: [] };

export function useCart() {
  const [state, dispatch] = useReducer(cartReducer, INITIAL);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    dispatch({ type: "ADD_ITEM", item });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ITEM", id });
  }, []);

  const setQty = useCallback((id: string, quantity: number) => {
    dispatch({ type: "SET_QTY", id, quantity });
  }, []);

  const clearCart = useCallback(() => dispatch({ type: "CLEAR" }), []);

  const setCoupon = useCallback((coupon: CouponState) => {
    dispatch({ type: "SET_COUPON", coupon });
  }, []);

  const clearCoupon = useCallback(() => dispatch({ type: "CLEAR_COUPON" }), []);

  const setSplit = useCallback((lines: SplitLine[]) => {
    dispatch({ type: "SET_SPLIT", lines });
  }, []);

  const clearSplit = useCallback(() => dispatch({ type: "CLEAR_SPLIT" }), []);

  // Derived totals
  const subtotal = state.items.reduce(
    (s, i) => s + i.unitPrice * i.quantity,
    0
  );
  const gstAmount = state.items.reduce(
    (s, i) => s + i.unitPrice * i.quantity * (i.gstRate / 100),
    0
  );
  const discountAmount = state.coupon?.discountAmount ?? 0;
  const totalAmount = Math.max(0, subtotal + gstAmount - discountAmount);
  const splitTotal = state.splitLines.reduce((s, l) => s + l.amount, 0);
  const splitRemaining = Math.round((totalAmount - splitTotal) * 100) / 100;

  return {
    items: state.items,
    coupon: state.coupon,
    splitLines: state.splitLines,
    totals: {
      subtotal: Math.round(subtotal * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    },
    splitRemaining,
    addItem,
    removeItem,
    setQty,
    clearCart,
    setCoupon,
    clearCoupon,
    setSplit,
    clearSplit,
  };
}
