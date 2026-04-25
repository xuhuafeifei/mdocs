export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface ApiOk<T> {
  data: T;
}
