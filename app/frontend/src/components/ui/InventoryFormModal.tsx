import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { createInventoryItem, updateInventoryItem } from "../../lib/api";
import type { InventoryItem, InventoryItemCreate } from "../../lib/api";
import { Modal } from "./Modal";
import { FormField } from "./FormField";

interface InventoryFormModalProps {
  item?: InventoryItem;
  nodeId: string;
  nodeType: "hub" | "spoke";
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRODUCT_TYPES = [
  { value: "", label: "Select type..." },
  { value: "Surgical", label: "Surgical" },
  { value: "Blood Collection", label: "Blood Collection" },
  { value: "Exam", label: "Exam" },
  { value: "Diagnostic", label: "Diagnostic" },
  { value: "IV Therapy", label: "IV Therapy" },
  { value: "Wound Care", label: "Wound Care" },
  { value: "PPE", label: "PPE" },
  { value: "Respiratory", label: "Respiratory" },
  { value: "Pharmaceutical", label: "Pharmaceutical" },
  { value: "Other", label: "Other" },
];

const PRODUCT_NOUNS = [
  { value: "", label: "Select category..." },
  { value: "Glove", label: "Glove" },
  { value: "Tube", label: "Tube" },
  { value: "Syringe", label: "Syringe" },
  { value: "Bandage", label: "Bandage" },
  { value: "Catheter", label: "Catheter" },
  { value: "Mask", label: "Mask" },
  { value: "Gauze", label: "Gauze" },
  { value: "Suture", label: "Suture" },
  { value: "Other", label: "Other" },
];

interface FormState {
  product_type: string;
  product_noun: string;
  item_description: string;
  manufacturer: string;
  quantity_on_hand: string;
  reorder_threshold: string;
  expiration_date: string;
  cold_chain_required: string;
}

const emptyForm: FormState = {
  product_type: "",
  product_noun: "",
  item_description: "",
  manufacturer: "",
  quantity_on_hand: "0",
  reorder_threshold: "0",
  expiration_date: "",
  cold_chain_required: "false",
};

function itemToForm(item: InventoryItem): FormState {
  return {
    product_type: item.product_type,
    product_noun: item.product_noun,
    item_description: item.item_description || "",
    manufacturer: item.manufacturer || "",
    quantity_on_hand: String(item.quantity_on_hand),
    reorder_threshold: String(item.reorder_threshold),
    expiration_date: item.expiration_date?.split("T")[0] || "",
    cold_chain_required: String(item.cold_chain_required),
  };
}

export function InventoryFormModal({ item, nodeId, nodeType, isOpen, onClose, onSuccess }: InventoryFormModalProps) {
  const isEdit = !!item;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(item ? itemToForm(item) : emptyForm);
      setError(null);
    }
  }, [isOpen, item]);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const createMutation = useMutation({
    mutationFn: (data: InventoryItemCreate) => createInventoryItem(data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InventoryItemCreate>) => updateInventoryItem(item!.id, data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: Error) => setError(err.message),
  });

  const pending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!form.product_type || !form.product_noun) {
      setError("Product type and category are required.");
      return;
    }

    const payload: InventoryItemCreate = {
      node_id: nodeId,
      node_type: nodeType,
      product_type: form.product_type,
      product_noun: form.product_noun,
      item_description: form.item_description || undefined,
      manufacturer: form.manufacturer || undefined,
      quantity_on_hand: Number(form.quantity_on_hand) || 0,
      reorder_threshold: Number(form.reorder_threshold) || 0,
      expiration_date: form.expiration_date || undefined,
      cold_chain_required: form.cold_chain_required === "true",
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Inventory Item" : "Add Inventory Item"}
      actions={
        <>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-border text-text-secondary hover:bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="px-3 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "Saving..." : isEdit ? "Update" : "Create"}
          </button>
        </>
      }
    >
      <div className="space-y-1">
        {error && (
          <div className="mb-3 px-3 py-2 bg-error/10 border border-error/30 rounded text-error-text text-sm">
            {error}
          </div>
        )}

        <FormField
          label="Product Type"
          type="select"
          value={form.product_type}
          onChange={set("product_type")}
          options={PRODUCT_TYPES}
        />
        <FormField
          label="Category"
          type="select"
          value={form.product_noun}
          onChange={set("product_noun")}
          options={PRODUCT_NOUNS}
        />
        <FormField
          label="Description"
          value={form.item_description}
          onChange={set("item_description")}
          placeholder="Item description"
        />
        <FormField
          label="Manufacturer"
          value={form.manufacturer}
          onChange={set("manufacturer")}
          placeholder="Manufacturer name"
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Quantity on Hand"
            type="number"
            value={form.quantity_on_hand}
            onChange={set("quantity_on_hand")}
          />
          <FormField
            label="Reorder Threshold"
            type="number"
            value={form.reorder_threshold}
            onChange={set("reorder_threshold")}
          />
        </div>
        <FormField
          label="Expiration Date"
          value={form.expiration_date}
          onChange={set("expiration_date")}
          placeholder="YYYY-MM-DD"
        />
        <FormField
          label="Cold Chain Required"
          type="select"
          value={form.cold_chain_required}
          onChange={set("cold_chain_required")}
          options={[
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ]}
        />
      </div>
    </Modal>
  );
}
