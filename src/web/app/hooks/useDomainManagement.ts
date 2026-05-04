import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import { getStoredVisitorId } from "../../services/client";
import {
  fetchDomainsApi,
  createDomainApi,
  renameDomainApi,
  updateDomainPermissionApi,
  deleteDomainApi,
} from "../../services/endpoints";
import type { DomainSummary } from "../../../shared/types/domain";
import {
  DOMAIN_PERMISSIONS,
  type DomainPermissionFilter,
  isBuiltInDomainId,
  isDomainCreator,
  isDomainStructurallyLocked,
} from "@shared/domainUi";
import { localizeDomainName, domainPermissionLabel } from "../utils";

export function useDomainManagement(active: boolean) {
  const { t, lang } = useI18n();
  const visitorId = getStoredVisitorId();

  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainPermission, setNewDomainPermission] = useState<string>("restricted");
  const [creating, setCreating] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [domainSearch, setDomainSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<DomainPermissionFilter>("all");
  const [changeTypeForId, setChangeTypeForId] = useState<string | null>(null);

  const loadDomains = useCallback(async (): Promise<void> => {
    setLoadingDomains(true);
    setDomainError(null);
    try {
      setDomains(await fetchDomainsApi());
    } catch {
      setDomainError(t("domainLoadFailed"));
    } finally {
      setLoadingDomains(false);
    }
  }, [t]);

  useEffect(() => {
    if (active) void loadDomains();
  }, [active, loadDomains]);

  async function handleCreateDomain(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!newDomainName.trim()) {
      setDomainError(t("domainNameRequired"));
      return;
    }
    setCreating(true);
    setDomainError(null);
    try {
      await createDomainApi({ domainName: newDomainName.trim(), permission: newDomainPermission });
      setNewDomainName("");
      setNewDomainPermission("restricted");
      await loadDomains();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(domainId: string): Promise<void> {
    if (!renameDraft.trim()) return;
    setDomainError(null);
    try {
      await renameDomainApi(domainId, renameDraft.trim());
      setRenamingId(null);
      setChangeTypeForId(null);
      await loadDomains();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : String(err));
    }
  }

  function startRename(d: DomainSummary): void {
    setRenamingId(d.domainId);
    setRenameDraft(d.domainName);
    setChangeTypeForId(null);
  }

  function cancelRename(): void {
    setRenamingId(null);
    setChangeTypeForId(null);
  }

  async function handlePermissionChange(domainId: string, permission: string): Promise<void> {
    setDomainError(null);
    try {
      await updateDomainPermissionApi(domainId, permission);
      setChangeTypeForId(null);
      await loadDomains();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(d: DomainSummary): Promise<void> {
    if (!window.confirm(t("deleteDomainConfirmDetail", { name: d.domainName, count: String(d.docCount) }))) return;
    setDomainError(null);
    try {
      await deleteDomainApi(d.domainId);
      await loadDomains();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : String(err));
    }
  }

  const plabel = useCallback((p: string) => domainPermissionLabel(p, t), [t]);

  const localizeDomain = useCallback((d: DomainSummary) => localizeDomainName(d.domainName, lang, t), [lang, t]);

  const filteredDomains = useMemo(() => {
    const q = domainSearch.trim().toLowerCase();
    return domains.filter((d) => {
      if (domainFilter !== "all" && d.permission !== domainFilter) return false;
      if (!q) return true;
      const shown = localizeDomainName(d.domainName, lang, t).toLowerCase();
      return shown.includes(q) || d.domainName.toLowerCase().includes(q);
    });
  }, [domains, domainSearch, domainFilter, lang, t]);

  const domainTypeLabel = useCallback(
    (d: DomainSummary, builtIn: boolean): string => {
      const base = plabel(d.permission);
      return builtIn ? `${base} ${t("domainTypeBuiltinSuffix")}` : base;
    },
    [plabel, t],
  );

  return {
    domains,
    loadingDomains,
    domainError,
    newDomainName,
    setNewDomainName,
    newDomainPermission,
    setNewDomainPermission,
    creating,
    handleCreateDomain,
    renamingId,
    setRenamingId,
    renameDraft,
    setRenameDraft,
    startRename,
    cancelRename,
    handleRename,
    changeTypeForId,
    setChangeTypeForId,
    handlePermissionChange,
    handleDelete,
    domainSearch,
    setDomainSearch,
    domainFilter,
    setDomainFilter,
    filteredDomains,
    visitorId,
    plabel,
    localizeDomain,
    domainTypeLabel,
  };
}
