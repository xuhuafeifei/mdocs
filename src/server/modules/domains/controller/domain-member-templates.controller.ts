import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { VisitorId } from "../../../nest/decorators/visitor.decorators.js";
import { RequireVisitorGuard } from "../../../nest/guards/require-visitor.guard.js";
import {
  createMemberTemplate,
  deleteMemberTemplate,
  listMemberTemplates,
  updateMemberTemplate,
} from "../application/domain-member-templates.application.js";
import { UpsertDomainMemberTemplateRequest } from "../request/upsert-domain-member-template.request.js";

@Controller("api/domain-member-templates")
@UseGuards(RequireVisitorGuard)
export class DomainMemberTemplatesController {
  @Get()
  list(@VisitorId() visitorId: string) {
    return listMemberTemplates(visitorId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @VisitorId() visitorId: string,
    @Body() body: UpsertDomainMemberTemplateRequest,
  ) {
    return createMemberTemplate({
      createVisitorId: visitorId,
      displayName: body.displayName,
      visitorIds: body.visitorIds,
    });
  }

  @Put(":id")
  update(
    @VisitorId() visitorId: string,
    @Param("id") id: string,
    @Body() body: UpsertDomainMemberTemplateRequest,
  ) {
    return updateMemberTemplate({
      createVisitorId: visitorId,
      idRaw: id,
      displayName: body.displayName,
      visitorIds: body.visitorIds,
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@VisitorId() visitorId: string, @Param("id") id: string): void {
    deleteMemberTemplate(visitorId, id);
  }
}
