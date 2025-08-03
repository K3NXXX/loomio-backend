import { RequestWithUser } from "./request-with-user.interface";

export interface RequestWithParams extends RequestWithUser {
  params: {
    projectId: string;
    [key: string]: string;
  };
}
