import { ValidResponse } from "../../interface/validResponse";
import { Request, Response } from "express";
import { RabbitMQService } from "../rabbitMQ";
import { v4 as uuidv4 } from "uuid";
import { createTimeoutPromise } from "../createTimeoutPromise";
import { processResponse } from "../processResponse";
import { ResponseStructure } from "../../interface/authorization_responseStructure";
const rabbitMQService = new RabbitMQService();
export async function validateAndAuthorize(
  req: Request,
  res: Response
): Promise<ValidResponse | Response<any>> {
  const authorizationHeader = req.headers.authorization;
  const correlationId = uuidv4();
  type ResponseType = ResponseStructure | { error: string };

  try {
    await rabbitMQService.publishToExchange(
      "authorization.ex",
      "",
      "authorization.stock",
      {
        token: authorizationHeader,
      },
      correlationId,
      "authorization.response_ex"
    );

    const timeout = 10000;
    const timeoutPromise = createTimeoutPromise<ResponseType>(timeout);
    const isListening = { value: true };

    const response: ResponseType = await Promise.race([
      rabbitMQService
        .listenForResponse(
          "authorization.response_stock",
          correlationId,
          isListening
        )
        .then((result) => {
          isListening.value = false;
          return result;
        }),
      timeoutPromise.then(() => {
        isListening.value = false;
        throw new Error("Timeout: Nenhuma resposta recebida a tempo.");
      }),
    ]);

    console.log(response);

    const access: ValidResponse = processResponse(
      response,
      res,
      "ROLE_TECHNICIAN"
    );

    if (!access.valid) {
      return res.status(403).json({ error: "acesso negado" });
    }

    return access;
  } catch (error) {
    console.error("Erro na validação e autorização:", error);
    return res
      .status(500)
      .json({ error: "Erro interno ao validar e autorizar o usuário." });
  }
}

export function isValidResponse(access: any): access is ValidResponse {
  return (access as ValidResponse).valid !== undefined;
}
