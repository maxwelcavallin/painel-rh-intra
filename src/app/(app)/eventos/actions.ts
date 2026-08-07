"use server";

import { revalidatePath } from "next/cache";

import { requireRH } from "@/lib/dal";
import {
  createEvent,
  deleteEvent,
  updateEvent,
  type EventInput,
} from "@/server/institutional-events";

export type EventState = { error?: string; ok?: boolean };

function readInput(formData: FormData): EventInput {
  const sector = String(formData.get("sector") ?? "").trim();
  return {
    title: String(formData.get("title") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    // O select manda string vazia para "empresa inteira".
    sector: sector || null,
  };
}

/**
 * As três ações revalidam `/ferias/solicitar` junto com `/eventos`: aquela tela
 * lê os eventos para avisar sobre conflito, e um evento cadastrado que só
 * aparecesse depois do cache expirar deixaria o aviso mudo justamente na
 * semana em que ele importa.
 */
function revalidar() {
  revalidatePath("/eventos");
  revalidatePath("/ferias/solicitar");
  revalidatePath("/calendario");
}

export async function createEventAction(
  _prev: EventState,
  formData: FormData,
): Promise<EventState> {
  const rh = await requireRH();

  const result = await createEvent(readInput(formData), rh.id);
  if (!result.ok) return { error: result.error };

  revalidar();
  return { ok: true };
}

export async function updateEventAction(
  _prev: EventState,
  formData: FormData,
): Promise<EventState> {
  await requireRH();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Evento não informado." };

  const result = await updateEvent(id, readInput(formData));
  if (!result.ok) return { error: result.error };

  revalidar();
  return { ok: true };
}

export async function deleteEventAction(id: string): Promise<EventState> {
  await requireRH();

  if (!id) return { error: "Evento não informado." };

  await deleteEvent(id);
  revalidar();
  return { ok: true };
}
