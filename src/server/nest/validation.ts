/**
 * tsx / esbuild 不 emit decorator metadata，全局 ValidationPipe 拿不到参数类型会 WARN 并跳过校验。
 * 对需要校验的 @Body / @Query 用 expectedType 显式声明 DTO（Nest 官方推荐）。
 */
import {
  BadRequestException,
  Body,
  Query,
  ValidationPipe,
  type Type,
  type ValidationPipeOptions,
} from "@nestjs/common";

export const validationPipeOptions: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  exceptionFactory: (errors) => {
    const message =
      errors.flatMap((e) => Object.values(e.constraints ?? {})).join("; ") ||
      "validation failed";
    return new BadRequestException(message);
  },
};

function pipeFor(expectedType: Type<unknown>): ValidationPipe {
  return new ValidationPipe({ ...validationPipeOptions, expectedType });
}

/** @Body + expectedType，tsx 下也能跑 class-validator */
export function ValidatedBody(type: Type<unknown>): ParameterDecorator {
  return Body(pipeFor(type));
}

/** @Query + expectedType */
export function ValidatedQuery(type: Type<unknown>): ParameterDecorator {
  return Query(pipeFor(type));
}
