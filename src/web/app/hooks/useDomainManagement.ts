/**
 * 域管理 Hook
 * 封装域列表的加载、创建、重命名、修改权限、删除等操作。
 * 包含 mountedRef 防护，避免组件卸载后执行 setState。
 * 同时提供搜索过滤和本地化显示能力。
 */
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

  // 当前登录访客的 ID（用于判断是否是域创建者）
  const visitorId = getStoredVisitorId();

  // ---- 用于防止组件卸载后 setState 的标记 ----
  const mountedRef = useRef(false);

  /**
   * ---- 域列表状态 ----
   */
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);

  /**
   * ---- 新建域表单状态 ----
   */
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainPermission, setNewDomainPermission] = useState<DomainPermissionValue>("restricted");
  const [creating, setCreating] = useState(false);

  /**
   * ---- 错误提示 ----
   */
  const [domainError, setDomainError] = useState<string | null>(null);

  /**
   * ---- 重命名状态 ----
   */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  /**
   * ---- 搜索过滤状态 ----
   */
  const [domainSearch, setDomainSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<DomainPermissionFilter>("all");

  /**
   * ---- 修改权限状态 ----
   */
  const [changeTypeForId, setChangeTypeForId] = useState<string | null>(null);

  /**
   * 挂载标记：用于异步操作后判断组件是否已卸载。
   */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * 加载域列表，带 mountedRef 防护防止卸载后 setState。
   */
  const loadDomains = useCallback(async (): Promise<void> => {
    setLoadingDomains(true);
    setDomainError(null);
    try {
      // 向后端请求域列表
      const doms = await fetchDomainsApi();
      // 组件已卸载时忽略结果
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

  /**
   * 组件挂载后自动加载域列表。
   */
  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  /**
   * 创建新域：校验名称非空 → 调接口 → 重置表单 → 刷新列表。
   */
  async function handleCreateDomain(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    // 名称不能为空
    if (!newDomainName.trim()) {
      setDomainError(t("domainNameRequired"));
      return;
    }
    setCreating(true);
    setDomainError(null);
    try {
      // 调用创建域 API
      await createDomainApi({ domainName: newDomainName.trim(), permission: newDomainPermission });
      // 组件已卸载时不更新状态
      if (!mountedRef.current) return;
      // 重置表单
      setNewDomainName("");
      setNewDomainPermission("restricted");
      // 刷新域列表
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

  /**
   * 重命名指定域。
   */
  async function handleRename(domainId: string): Promise<void> {
    // 名称不能为空
    if (!renameDraft.trim()) return;
    setDomainError(null);
    try {
      await renameDomainApi(domainId, renameDraft.trim());
      if (!mountedRef.current) return;
      // 关闭重命名状态
      setRenamingId(null);
      setChangeTypeForId(null);
      await loadDomains();
    } catch (err) {
      if (!mountedRef.current) return;
      setDomainError(translateError(t, err));
    }
  }

  /**
   * 进入重命名状态：填充当前名称到输入框。
   */
  function startRename(d: DomainSummary): void {
    setRenamingId(d.domainId);
    setRenameDraft(d.domainName);
    setChangeTypeForId(null);
  }

  /**
   * 取消重命名状态。
   */
  function cancelRename(): void {
    setRenamingId(null);
    setChangeTypeForId(null);
  }

  /**
   * 修改域的权限类型（公开/受限/私有）。
   */
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

  /**
   * 删除域：先确认弹窗（提示文档数量），成功后刷新列表。
   */
  async function handleDelete(d: DomainSummary): Promise<void> {
    // 弹出确认框，显示域名称和文档数量
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

  // 权限标签翻译函数（带 useCallback 缓存）
  const plabel = useCallback((p: string) => domainPermissionLabel(p, t), [t]);

  // 域名称本地化函数（带 useCallback 缓存）
  const localizeDomain = useCallback((d: DomainSummary) => localizeDomainName(d.domainName, lang, t), [lang, t]);

  /**
   * 根据搜索词和权限过滤域列表，同时支持按本地化名称或原始名称匹配。
   */
  const filteredDomains = useMemo(() => {
    // 去除首尾空格并转为小写
    const q = domainSearch.trim().toLowerCase();
    return domains.filter((d) => {
      // 按权限过滤（如果不是 "all"）
      if (domainFilter !== "all" && d.permission !== domainFilter) return false;
      // 没有搜索词时全部通过
      if (!q) return true;
      // 同时匹配本地化名称和原始名称
      const shown = localizeDomainName(d.domainName, lang, t).toLowerCase();
      return shown.includes(q) || d.domainName.toLowerCase().includes(q);
    });
  }, [domains, domainSearch, domainFilter, lang, t]);

  /**
   * 生成域类型标签：基础权限标签 + 内置域后缀。
   */
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
