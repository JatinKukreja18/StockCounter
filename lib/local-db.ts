"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LocalCountEntry, Product } from "@/lib/types";

interface StockCountDB extends DBSchema {
  products: {
    key: string;
    value: Product;
    indexes: { barcode: string; sku: string; name: string };
  };
  entries: {
    key: string;
    value: LocalCountEntry;
    indexes: { syncState: string; createdAt: string };
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
}

let database: Promise<IDBPDatabase<StockCountDB>> | null = null;

function db() {
  if (!database) {
    database = openDB<StockCountDB>("sekai-stock-count", 1, {
      upgrade(store) {
        const products = store.createObjectStore("products", { keyPath: "id" });
        products.createIndex("barcode", "barcode", { unique: false });
        products.createIndex("sku", "sku", { unique: false });
        products.createIndex("name", "name", { unique: false });

        const entries = store.createObjectStore("entries", { keyPath: "localEntryId" });
        entries.createIndex("syncState", "syncState", { unique: false });
        entries.createIndex("createdAt", "createdAt", { unique: false });

        store.createObjectStore("meta", { keyPath: "key" });
      }
    });
  }
  return database;
}

export async function cacheProducts(products: Product[], ownerId: string) {
  await setMeta(`products:${ownerId}`, JSON.stringify(products));
}

export async function getCachedProducts(ownerId: string) {
  const cached = await getMeta(`products:${ownerId}`);
  return cached ? JSON.parse(cached) as Product[] : [];
}

export async function findCachedProduct(query: string, ownerId: string) {
  const value = query.trim().toLowerCase();
  const products = await getCachedProducts(ownerId);
  return products.find(
    (product) =>
      product.barcode === value ||
      product.sku.toLowerCase() === value ||
      product.name.toLowerCase().includes(value)
  );
}

export async function saveLocalEntry(entry: LocalCountEntry) {
  await (await db()).put("entries", entry);
}

export async function getLocalEntries() {
  const entries = await (await db()).getAll("entries");
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPendingEntries() {
  const entries = await getLocalEntries();
  return entries.filter((entry) => entry.syncState === "pending" || entry.syncState === "failed");
}

export async function updateLocalEntry(id: string, patch: Partial<LocalCountEntry>) {
  const store = await db();
  const entry = await store.get("entries", id);
  if (!entry) return;
  await store.put("entries", { ...entry, ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteLocalEntry(id: string) {
  const store = await db();
  const entry = await store.get("entries", id);
  if (entry?.syncState === "synced") throw new Error("Synced entries cannot be deleted locally.");
  await store.delete("entries", id);
}

export async function setMeta(key: string, value: string) {
  await (await db()).put("meta", { key, value });
}

export async function getMeta(key: string) {
  return (await db()).get("meta", key).then((item) => item?.value);
}

export async function getDeviceId() {
  const existing = await getMeta("deviceId");
  if (existing) return existing;
  const id = crypto.randomUUID();
  await setMeta("deviceId", id);
  return id;
}
