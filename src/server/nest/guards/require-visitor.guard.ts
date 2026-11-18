import { CanActivate, Injectable } from "@nestjs/common";
import { VisitorError } from "../../modules/visitor/service/visitor.service.js";
import { VisitorContext } from "../context/visitor.context.js";

/** 要求已解析出访客（VisitorContext）；否则 401 */
@Injectable()
export class RequireVisitorGuard implements CanActivate {
  canActivate(): boolean {
    if (!VisitorContext.visitor()) {
      throw new VisitorError("UNAUTHENTICATED", "no visitor", 401);
    }
    return true;
  }
}
