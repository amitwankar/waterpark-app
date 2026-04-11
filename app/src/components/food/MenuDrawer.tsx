"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { formatCurrency } from "@/lib/utils";

interface Outlet { id: string; name: string }

interface FoodVariant {
  id: string;
  foodItemId: string;
  name: string;
  sku: string | null;
  price: number;
  preBookPrice: number | null;
  sortOrder: number;
  isDefault: boolean;
  isAvailable: boolean;
}

interface FoodItem {
  id: string;
  categoryId?: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  preBookPrice: number | null;
  gstRate: number;
  prepTimeMin: number | null;
  allergens: string[];
  isVeg: boolean;
  isFeatured: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  sortOrder: number;
  variants?: FoodVariant[];
  modifierGroups?: FoodModifierGroup[];
}

interface FoodModifierGroup {
  id: string;
  foodItemId: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  options: FoodModifierOption[];
}

interface FoodModifierOption {
  id: string;
  groupId: string;
  name: string;
  price: number;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  items: FoodItem[];
}

interface Props {
  outlet: Outlet;
  onClose: () => void;
}

export function MenuDrawer({ outlet, onClose }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showModifierModal, setShowModifierModal] = useState(false);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [editingVariant, setEditingVariant] = useState<FoodVariant | null>(null);
  const [editingModifierGroup, setEditingModifierGroup] = useState<FoodModifierGroup | null>(null);
  const [editingModifierOption, setEditingModifierOption] = useState<FoodModifierOption | null>(null);

  const [targetCategoryId, setTargetCategoryId] = useState<string>("");
  const [targetItem, setTargetItem] = useState<FoodItem | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categorySortOrder, setCategorySortOrder] = useState("0");

  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemPrice, setItemPrice] = useState("0");
  const [itemPreBookPrice, setItemPreBookPrice] = useState("");
  const [itemGstRate, setItemGstRate] = useState("5");
  const [itemPrepTimeMin, setItemPrepTimeMin] = useState("");
  const [itemAllergens, setItemAllergens] = useState("");
  const [itemSortOrder, setItemSortOrder] = useState("0");
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemIsFeatured, setItemIsFeatured] = useState(false);
  const [itemAvailable, setItemAvailable] = useState(true);

  const [variantName, setVariantName] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [variantPrice, setVariantPrice] = useState("0");
  const [variantPreBookPrice, setVariantPreBookPrice] = useState("");
  const [variantSortOrder, setVariantSortOrder] = useState("0");
  const [variantIsDefault, setVariantIsDefault] = useState(false);
  const [variantIsAvailable, setVariantIsAvailable] = useState(true);
  const [modifierGroupName, setModifierGroupName] = useState("");
  const [modifierGroupMinSelect, setModifierGroupMinSelect] = useState("0");
  const [modifierGroupMaxSelect, setModifierGroupMaxSelect] = useState("1");
  const [modifierGroupSortOrder, setModifierGroupSortOrder] = useState("0");
  const [modifierGroupIsRequired, setModifierGroupIsRequired] = useState(false);
  const [modifierOptionGroupId, setModifierOptionGroupId] = useState("");
  const [modifierOptionName, setModifierOptionName] = useState("");
  const [modifierOptionPrice, setModifierOptionPrice] = useState("0");
  const [modifierOptionSortOrder, setModifierOptionSortOrder] = useState("0");
  const [modifierOptionIsDefault, setModifierOptionIsDefault] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        fetch(`/api/v1/food/categories?outletId=${outlet.id}`),
        fetch(`/api/v1/food/items?outletId=${outlet.id}`),
      ]);

      const categoryRows = categoriesRes.ok
        ? ((await categoriesRes.json()) as Array<{ id: string; name: string; sortOrder: number; isActive: boolean }>)
        : [];
      const itemRows = itemsRes.ok ? ((await itemsRes.json()) as FoodItem[]) : [];

      const grouped = categoryRows.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        items: itemRows
          .filter((item) => item.categoryId === category.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));

      setCategories(grouped);
    } finally {
      setLoading(false);
    }
  }

  async function toggleItem(itemId: string, isAvailable: boolean) {
    await fetch(`/api/v1/food/items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !isAvailable }),
    });
    await load();
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Remove this item from the menu?")) return;
    await fetch(`/api/v1/food/items/${itemId}`, { method: "DELETE" });
    await load();
  }

  function openAddCategory(): void {
    setSaveError(null);
    setEditingCategory(null);
    setCategoryName("");
    setCategorySortOrder("0");
    setShowCategoryModal(true);
  }

  function openEditCategory(category: Category): void {
    setSaveError(null);
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategorySortOrder(String(category.sortOrder));
    setShowCategoryModal(true);
  }

  async function deleteCategory(categoryId: string): Promise<void> {
    if (!confirm("Delete this category?")) return;
    await fetch(`/api/v1/food/categories/${categoryId}`, { method: "DELETE" });
    await load();
  }

  function resetItemForm() {
    setItemName("");
    setItemDescription("");
    setItemSku("");
    setItemImageUrl("");
    setItemPrice("0");
    setItemPreBookPrice("");
    setItemGstRate("5");
    setItemPrepTimeMin("");
    setItemAllergens("");
    setItemSortOrder("0");
    setItemIsVeg(true);
    setItemIsFeatured(false);
    setItemAvailable(true);
  }

  function openAddItem(categoryId: string): void {
    setSaveError(null);
    setEditingItem(null);
    setTargetCategoryId(categoryId);
    resetItemForm();
    setShowItemModal(true);
  }

  function openEditItem(item: FoodItem, categoryId: string): void {
    setSaveError(null);
    setEditingItem(item);
    setTargetCategoryId(categoryId);
    setItemName(item.name);
    setItemDescription(item.description ?? "");
    setItemSku(item.sku ?? "");
    setItemImageUrl(item.imageUrl ?? "");
    setItemPrice(String(item.price));
    setItemPreBookPrice(item.preBookPrice === null ? "" : String(item.preBookPrice));
    setItemGstRate(String(item.gstRate));
    setItemPrepTimeMin(item.prepTimeMin === null ? "" : String(item.prepTimeMin));
    setItemAllergens((item.allergens ?? []).join(", "));
    setItemSortOrder(String(item.sortOrder));
    setItemIsVeg(item.isVeg);
    setItemIsFeatured(item.isFeatured);
    setItemAvailable(item.isAvailable);
    setShowItemModal(true);
  }

  function resetVariantForm() {
    setVariantName("");
    setVariantSku("");
    setVariantPrice("0");
    setVariantPreBookPrice("");
    setVariantSortOrder("0");
    setVariantIsDefault(false);
    setVariantIsAvailable(true);
  }

  function openManageVariants(item: FoodItem): void {
    setTargetItem(item);
    setEditingVariant(null);
    resetVariantForm();
    setSaveError(null);
    setShowVariantModal(true);
  }

  function openManageModifiers(item: FoodItem): void {
    setTargetItem(item);
    setEditingModifierGroup(null);
    setEditingModifierOption(null);
    setModifierGroupName("");
    setModifierGroupMinSelect("0");
    setModifierGroupMaxSelect("1");
    setModifierGroupSortOrder("0");
    setModifierGroupIsRequired(false);
    setModifierOptionGroupId("");
    setModifierOptionName("");
    setModifierOptionPrice("0");
    setModifierOptionSortOrder("0");
    setModifierOptionIsDefault(false);
    setSaveError(null);
    setShowModifierModal(true);
  }

  function openEditVariant(variant: FoodVariant): void {
    setEditingVariant(variant);
    setVariantName(variant.name);
    setVariantSku(variant.sku ?? "");
    setVariantPrice(String(variant.price));
    setVariantPreBookPrice(variant.preBookPrice === null ? "" : String(variant.preBookPrice));
    setVariantSortOrder(String(variant.sortOrder));
    setVariantIsDefault(variant.isDefault);
    setVariantIsAvailable(variant.isAvailable);
    setSaveError(null);
  }

  async function saveCategory(): Promise<void> {
    if (!categoryName.trim()) return;
    setSaveError(null);
    if (editingCategory) {
      const response = await fetch(`/api/v1/food/categories/${editingCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim(), sortOrder: Number(categorySortOrder || "0") }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setSaveError(payload?.error ?? "Failed to update category");
        return;
      }
    } else {
      const response = await fetch("/api/v1/food/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outletId: outlet.id, name: categoryName.trim(), sortOrder: Number(categorySortOrder || "0") }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setSaveError(payload?.error ?? "Failed to create category");
        return;
      }
    }
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryName("");
    setCategorySortOrder("0");
    await load();
  }

  async function saveItem(): Promise<void> {
    if (!targetCategoryId || !itemName.trim()) return;
    setSaveError(null);
    const allergens = itemAllergens
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      categoryId: targetCategoryId,
      name: itemName.trim(),
      description: itemDescription.trim() || undefined,
      sku: itemSku.trim() || null,
      imageUrl: itemImageUrl.trim() || null,
      price: Number(itemPrice || "0"),
      preBookPrice: itemPreBookPrice.trim().length > 0 ? Number(itemPreBookPrice) : null,
      gstRate: Number(itemGstRate || "5"),
      prepTimeMin: itemPrepTimeMin.trim().length > 0 ? Number(itemPrepTimeMin) : null,
      allergens,
      isVeg: itemIsVeg,
      isFeatured: itemIsFeatured,
      isAvailable: itemAvailable,
      sortOrder: Number(itemSortOrder || "0"),
    };
    const url = editingItem ? `/api/v1/food/items/${editingItem.id}` : "/api/v1/food/items";
    const method = editingItem ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const payloadErr = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaveError(payloadErr?.error ?? `Failed to ${editingItem ? "update" : "create"} menu item`);
      return;
    }
    setShowItemModal(false);
    setEditingItem(null);
    await load();
  }

  async function saveVariant(): Promise<void> {
    if (!targetItem || !variantName.trim()) return;
    setSaveError(null);

    const payload = {
      name: variantName.trim(),
      sku: variantSku.trim() || null,
      price: Number(variantPrice || "0"),
      preBookPrice: variantPreBookPrice.trim().length > 0 ? Number(variantPreBookPrice) : null,
      sortOrder: Number(variantSortOrder || "0"),
      isDefault: variantIsDefault,
      isAvailable: variantIsAvailable,
    };

    const url = editingVariant
      ? `/api/v1/food/items/${targetItem.id}/variants/${editingVariant.id}`
      : `/api/v1/food/items/${targetItem.id}/variants`;
    const method = editingVariant ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const payloadErr = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaveError(payloadErr?.error ?? `Failed to ${editingVariant ? "update" : "create"} variant`);
      return;
    }

    const res = await fetch(`/api/v1/food/items/${targetItem.id}`);
    if (res.ok) {
      const nextItem = (await res.json()) as FoodItem;
      setTargetItem(nextItem);
      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          items: category.items.map((item) => (item.id === nextItem.id ? nextItem : item)),
        })),
      );
    }

    setEditingVariant(null);
    resetVariantForm();
  }

  async function refreshTargetItem(itemId: string): Promise<void> {
    const res = await fetch(`/api/v1/food/items/${itemId}`);
    if (!res.ok) return;
    const nextItem = (await res.json()) as FoodItem;
    setTargetItem(nextItem);
    setCategories((prev) =>
      prev.map((category) => ({
        ...category,
        items: category.items.map((item) => (item.id === nextItem.id ? nextItem : item)),
      })),
    );
  }

  async function saveModifierGroup(): Promise<void> {
    if (!targetItem || !modifierGroupName.trim()) return;
    setSaveError(null);

    const payload = {
      name: modifierGroupName.trim(),
      minSelect: Number(modifierGroupMinSelect || "0"),
      maxSelect: Number(modifierGroupMaxSelect || "1"),
      isRequired: modifierGroupIsRequired,
      sortOrder: Number(modifierGroupSortOrder || "0"),
      isActive: true,
    };

    const url = editingModifierGroup
      ? `/api/v1/food/items/${targetItem.id}/modifier-groups/${editingModifierGroup.id}`
      : `/api/v1/food/items/${targetItem.id}/modifier-groups`;
    const method = editingModifierGroup ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaveError(body?.error ?? "Failed to save modifier group");
      return;
    }
    setEditingModifierGroup(null);
    setModifierGroupName("");
    setModifierGroupMinSelect("0");
    setModifierGroupMaxSelect("1");
    setModifierGroupSortOrder("0");
    setModifierGroupIsRequired(false);
    await refreshTargetItem(targetItem.id);
  }

  async function saveModifierOption(): Promise<void> {
    if (!targetItem || !modifierOptionGroupId || !modifierOptionName.trim()) return;
    setSaveError(null);
    const payload = {
      name: modifierOptionName.trim(),
      price: Number(modifierOptionPrice || "0"),
      sortOrder: Number(modifierOptionSortOrder || "0"),
      isDefault: modifierOptionIsDefault,
      isActive: true,
    };
    const url = editingModifierOption
      ? `/api/v1/food/items/${targetItem.id}/modifier-groups/${modifierOptionGroupId}/options/${editingModifierOption.id}`
      : `/api/v1/food/items/${targetItem.id}/modifier-groups/${modifierOptionGroupId}/options`;
    const method = editingModifierOption ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaveError(body?.error ?? "Failed to save modifier option");
      return;
    }
    setEditingModifierOption(null);
    setModifierOptionName("");
    setModifierOptionPrice("0");
    setModifierOptionSortOrder("0");
    setModifierOptionIsDefault(false);
    await refreshTargetItem(targetItem.id);
  }

  async function deleteModifierGroup(groupId: string): Promise<void> {
    if (!targetItem) return;
    if (!confirm("Delete this modifier group?")) return;
    await fetch(`/api/v1/food/items/${targetItem.id}/modifier-groups/${groupId}`, { method: "DELETE" });
    await refreshTargetItem(targetItem.id);
  }

  async function deleteModifierOption(groupId: string, optionId: string): Promise<void> {
    if (!targetItem) return;
    if (!confirm("Delete this modifier option?")) return;
    await fetch(`/api/v1/food/items/${targetItem.id}/modifier-groups/${groupId}/options/${optionId}`, { method: "DELETE" });
    await refreshTargetItem(targetItem.id);
  }

  async function deleteVariant(variantId: string): Promise<void> {
    if (!targetItem) return;
    if (!confirm("Delete this variant?")) return;

    const response = await fetch(`/api/v1/food/items/${targetItem.id}/variants/${variantId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payloadErr = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaveError(payloadErr?.error ?? "Failed to delete variant");
      return;
    }

    const res = await fetch(`/api/v1/food/items/${targetItem.id}`);
    if (res.ok) {
      const nextItem = (await res.json()) as FoodItem;
      setTargetItem(nextItem);
      setCategories((prev) =>
        prev.map((category) => ({
          ...category,
          items: category.items.map((item) => (item.id === nextItem.id ? nextItem : item)),
        })),
      );
    }
  }

  useEffect(() => { void load(); }, [outlet.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => {
      void load();
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet.id]);

  return (
    <Drawer open title={`Menu — ${outlet.name}`} onClose={onClose} widthClassName="w-full max-w-4xl">
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          {categories.length === 0 && (
            <p className="text-center text-sm text-[var(--color-muted)] py-8">No categories yet. Add category first.</p>
          )}

          {categories.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[var(--color-text)]">{cat.name}</h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openEditCategory(cat)} className="rounded p-1 hover:bg-[var(--color-border)] text-[var(--color-muted)]" title="Edit category">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => void deleteCategory(cat.id)} className="rounded p-1 hover:bg-red-50 text-red-400 hover:text-red-600" title="Delete category">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Button size="sm" variant="outline" onClick={() => openAddItem(cat.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {cat.items.map((item) => (
                  <div key={item.id} className="rounded-[var(--radius-input)] border border-[var(--color-border)] p-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 shrink-0 rounded-full border-2 ${item.isVeg ? "border-green-600 bg-green-500" : "border-red-600 bg-red-500"}`} />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">{item.name}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {formatCurrency(item.price)}
                          {item.preBookPrice ? <span className="ml-1 text-[var(--color-primary)]">/ {formatCurrency(item.preBookPrice)} pre-book</span> : null}
                          {" · "}GST {item.gstRate}%
                          {item.prepTimeMin ? <span>{` · ${item.prepTimeMin} min`}</span> : null}
                        </p>
                        {item.allergens?.length ? (
                          <p className="text-[11px] text-orange-600 mt-0.5">Allergens: {item.allergens.join(", ")}</p>
                        ) : null}
                        {item.description ? <p className="text-[11px] text-[var(--color-muted)] mt-0.5 line-clamp-1">{item.description}</p> : null}
                      </div>

                      <div className="flex gap-1 items-center">
                        {item.isFeatured ? <Badge variant="info">Featured</Badge> : null}
                        <Badge variant={item.isAvailable ? "success" : "default"}>{item.isAvailable ? "Available" : "Off"}</Badge>
                      </div>

                      <div className="flex gap-1">
                        <button type="button" onClick={() => openEditItem(item, cat.id)} className="rounded p-1 hover:bg-[var(--color-border)] text-[var(--color-muted)]" title="Edit item">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => void toggleItem(item.id, item.isAvailable)} className="rounded p-1 hover:bg-[var(--color-border)] text-[var(--color-muted)]" title="Toggle availability">
                          {item.isAvailable ? "Off" : "On"}
                        </button>
                        <button type="button" onClick={() => void deleteItem(item.id)} className="rounded p-1 hover:bg-red-50 text-red-400 hover:text-red-600" title="Remove item">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs text-[var(--color-muted)]">
                        SKU: {item.sku ?? "-"} · Variants: {item.variants?.length ?? 0} · Modifiers: {item.modifierGroups?.length ?? 0}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openManageVariants(item)}>Manage Variants</Button>
                        <Button size="sm" variant="outline" onClick={() => openManageModifiers(item)}>Manage Modifiers</Button>
                      </div>
                    </div>
                  </div>
                ))}

                {cat.items.length === 0 && <p className="text-xs text-[var(--color-muted)] pl-2">No items in this category.</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-4">
        <Button size="sm" onClick={openAddCategory}><Plus className="h-3 w-3 mr-1" /> Add Category</Button>
      </div>

      {showCategoryModal ? (
        <Modal open title={editingCategory ? "Edit Category" : "Add Category"} onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}>
          <div className="space-y-3">
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            <Input label="Name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
            <Input label="Sort Order" type="number" value={categorySortOrder} onChange={(event) => setCategorySortOrder(event.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}>Cancel</Button>
              <Button onClick={() => void saveCategory()}>{editingCategory ? "Update" : "Save"}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showItemModal ? (
        <Modal open title={editingItem ? "Edit Menu Item" : "Add Menu Item"} onClose={() => setShowItemModal(false)}>
          <div className="space-y-3">
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            <Input label="Name" value={itemName} onChange={(event) => setItemName(event.target.value)} />
            <Input label="SKU" value={itemSku} onChange={(event) => setItemSku(event.target.value)} placeholder="Optional" />
            <Input label="Image URL" value={itemImageUrl} onChange={(event) => setItemImageUrl(event.target.value)} placeholder="Optional" />
            <Input label="Price" type="number" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} />
            <Input label="Pre-book Price" type="number" value={itemPreBookPrice} onChange={(event) => setItemPreBookPrice(event.target.value)} />
            <Input label="GST Rate (%)" type="number" value={itemGstRate} onChange={(event) => setItemGstRate(event.target.value)} />
            <Input label="Prep Time (min)" type="number" value={itemPrepTimeMin} onChange={(event) => setItemPrepTimeMin(event.target.value)} />
            <Input label="Allergens (comma separated)" value={itemAllergens} onChange={(event) => setItemAllergens(event.target.value)} placeholder="Peanuts, Dairy" />
            <Input label="Sort Order" type="number" value={itemSortOrder} onChange={(event) => setItemSortOrder(event.target.value)} />
            <div className="space-y-1">
              <label className="text-xs text-[var(--color-muted)]">Description</label>
              <textarea className="w-full rounded-[var(--radius-input)] border border-[var(--color-border)] p-2 text-sm" value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemIsVeg} onChange={(event) => setItemIsVeg(event.target.checked)} /> Veg Item</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemIsFeatured} onChange={(event) => setItemIsFeatured(event.target.checked)} /> Featured Item</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemAvailable} onChange={(event) => setItemAvailable(event.target.checked)} /> Available</label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowItemModal(false)}>Cancel</Button>
              <Button onClick={() => void saveItem()}>{editingItem ? "Update" : "Create"}</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showVariantModal && targetItem ? (
        <Modal open title={`Variants — ${targetItem.name}`} onClose={() => { setShowVariantModal(false); setTargetItem(null); setEditingVariant(null); }}>
          <div className="space-y-3">
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}

            <div className="rounded-md border border-[var(--color-border)] p-3 space-y-2">
              {(targetItem.variants ?? []).length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">No variants yet.</p>
              ) : (
                (targetItem.variants ?? []).map((variant) => (
                  <div key={variant.id} className="flex items-center justify-between text-sm border-b border-[var(--color-border)] pb-1 last:border-b-0">
                    <div>
                      <span className="font-medium">{variant.name}</span>
                      <span className="text-[var(--color-muted)] ml-2">{formatCurrency(variant.price)}</span>
                      {variant.isDefault ? <Badge className="ml-2" variant="info">Default</Badge> : null}
                      {!variant.isAvailable ? <Badge className="ml-2" variant="default">Off</Badge> : null}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEditVariant(variant)} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => void deleteVariant(variant.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input label="Variant Name" value={variantName} onChange={(e) => setVariantName(e.target.value)} />
              <Input label="SKU" value={variantSku} onChange={(e) => setVariantSku(e.target.value)} />
              <Input label="Price" type="number" value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} />
              <Input label="Pre-book Price" type="number" value={variantPreBookPrice} onChange={(e) => setVariantPreBookPrice(e.target.value)} />
              <Input label="Sort Order" type="number" value={variantSortOrder} onChange={(e) => setVariantSortOrder(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={variantIsDefault} onChange={(e) => setVariantIsDefault(e.target.checked)} /> Default variant</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={variantIsAvailable} onChange={(e) => setVariantIsAvailable(e.target.checked)} /> Available</label>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setEditingVariant(null); resetVariantForm(); }}>Reset</Button>
              <Button onClick={() => void saveVariant()}>{editingVariant ? "Update Variant" : "Add Variant"}</Button>
            </div>
          </div>
        </Modal>
      ) : null}
      {showModifierModal && targetItem ? (
        <Modal open title={`Modifiers — ${targetItem.name}`} onClose={() => setShowModifierModal(false)}>
          <div className="space-y-4">
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}

            <div className="rounded-md border border-[var(--color-border)] p-3 space-y-2 max-h-56 overflow-auto">
              {(targetItem.modifierGroups ?? []).length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">No modifier groups yet.</p>
              ) : (
                (targetItem.modifierGroups ?? []).map((group) => (
                  <div key={group.id} className="border-b border-[var(--color-border)] pb-2 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{group.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">min {group.minSelect} · max {group.maxSelect} {group.isRequired ? "· required" : ""}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => {
                          setEditingModifierGroup(group);
                          setModifierGroupName(group.name);
                          setModifierGroupMinSelect(String(group.minSelect));
                          setModifierGroupMaxSelect(String(group.maxSelect));
                          setModifierGroupSortOrder(String(group.sortOrder));
                          setModifierGroupIsRequired(group.isRequired);
                        }}><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => void deleteModifierGroup(group.id)} className="text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="mt-1 space-y-1">
                      {group.options.map((option) => (
                        <div key={option.id} className="flex items-center justify-between text-xs">
                          <span>{option.name} ({formatCurrency(option.price)}) {option.isDefault ? "· default" : ""}</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => {
                              setEditingModifierOption(option);
                              setModifierOptionGroupId(group.id);
                              setModifierOptionName(option.name);
                              setModifierOptionPrice(String(option.price));
                              setModifierOptionSortOrder(String(option.sortOrder));
                              setModifierOptionIsDefault(option.isDefault);
                            }}><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => void deleteModifierOption(group.id, option.id)} className="text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input label="Group Name" value={modifierGroupName} onChange={(e) => setModifierGroupName(e.target.value)} />
              <Input label="Group Sort Order" type="number" value={modifierGroupSortOrder} onChange={(e) => setModifierGroupSortOrder(e.target.value)} />
              <Input label="Min Select" type="number" value={modifierGroupMinSelect} onChange={(e) => setModifierGroupMinSelect(e.target.value)} />
              <Input label="Max Select" type="number" value={modifierGroupMaxSelect} onChange={(e) => setModifierGroupMaxSelect(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={modifierGroupIsRequired} onChange={(e) => setModifierGroupIsRequired(e.target.checked)} /> Required group</label>
            <div className="flex justify-end"><Button onClick={() => void saveModifierGroup()}>{editingModifierGroup ? "Update Group" : "Add Group"}</Button></div>

            <div className="border-t border-[var(--color-border)] pt-3 grid grid-cols-2 gap-2">
              <Select
                value={modifierOptionGroupId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setModifierOptionGroupId(e.target.value)}
                options={(targetItem.modifierGroups ?? []).map((g) => ({ label: g.name, value: g.id }))}
              />
              <Input label="Option Name" value={modifierOptionName} onChange={(e) => setModifierOptionName(e.target.value)} />
              <Input label="Option Price" type="number" value={modifierOptionPrice} onChange={(e) => setModifierOptionPrice(e.target.value)} />
              <Input label="Option Sort Order" type="number" value={modifierOptionSortOrder} onChange={(e) => setModifierOptionSortOrder(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={modifierOptionIsDefault} onChange={(e) => setModifierOptionIsDefault(e.target.checked)} /> Default option</label>
            <div className="flex justify-end"><Button onClick={() => void saveModifierOption()}>{editingModifierOption ? "Update Option" : "Add Option"}</Button></div>
          </div>
        </Modal>
      ) : null}
    </Drawer>
  );
}
