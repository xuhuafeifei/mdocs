/** 域成员模板出参（驼峰，与现有 HTTP JSON 一致）。 */
export type DomainMemberTemplateResponse = {
  id: number;
  displayName: string;
  visitorIds: string[];
  createTime: string;
  updateTime: string;
};
