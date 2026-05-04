import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type DomainPermissionValue,
  isBuiltInDomainId,
  isDomainCreator,
  isDomainStructurallyLocked,
} from "@shared/domainUi";
import { localizeDomainName, domainPermissionLabel, translateError } from "../utils";

export function useDomainManagement() {
  const { t, lang } = useI18n();
  const visitorId = getStoredVisitorId();
  const mountedRef = useRef(false);

  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainPermission, setNewDomainPermission] = useState<DomainPermissionValue>("restricted");
  const [creating, setCreating] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [domainSearch, setDomainSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<DomainPermissionFilter>("all");
  const [changeTypeForId, setChangeTypeForId] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadDomains = useCallback(async (): Promise<void> => {
    setLoadingDomains(true);
    setDomainError(null);
    try {
      const doms = await fetchDomainsApi();
      if (!mountedRef.current) return;
      setDomains(doms);
    } catch (err) {
      if (!mountedRef.current) return;
      setDomainError(translateError(t, err));
    } finally {
      if (mountedRef.current) {
        setLoadingDomains(false);
      }
    }
  }, [t]);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

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
      if (!mountedRef.current) return;
      setNewDomainName("");
      setNewDomainPermission("restricted");
      await loadDomains();
    } catch (err) {
      if (!mountedRef.current) return;
      setDomainError(translateError(t, err));
    } finally {
      if (mountedRef.current) {
        setCreating(false);
      }
    }
  }

  async function handleRename(domainId: string): Promise<void> {
    if (!renameDraft.trim()) return;
    setDomainError(null);
    try {
      await renameDomainApi(domainId, renameDraft.trim());
      if (!mountedRef.current) return;
      setRenamingId(null);
      setChangeTypeForId(null);
      await loadDomains();
    } catch (err) {
      if (!mountedRef.current) return;
      setDomainError(translateError(t, err));
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

  async function handlePermissionChange(domainId: string, permission: DomainPermissionValue): Promise<void> {
    setDomainError(null);
    try {
      await updateDomainPermissionApi(domainId, permission);
      if (!mountedRef.current) return;
      setChangeTypeForId(null);
      await loadDomains();
    } catch (err) {
      if (!mountedRef.current) return;
      setDomainError(translateError(t, err));
    }
  }

  async function handleDelete(d: DomainSummary): Promise<void> {
    if (!window.confirm(t("deleteDomainConfirmDetail", { name: d.domainName, count: String(d.docCount) }))) return;
    setDomainError(null);
    try {
      await deleteDomainApi(d.domainId);
      if (!mountedRef.current) return;
      await loadDomains();
    } catch (err) {
      if (!mountedRef.current) return;
      setDomainError(translateError(t, err));
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
