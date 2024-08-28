import amqp, { Channel, Connection } from "amqplib";
import dotenv from "dotenv";

dotenv.config();

export class RabbitMQService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;

  constructor() {
    this.initializeRabbitMQ();
  }

  private async initializeRabbitMQ() {
    if (!this.channel) {
      try {
        this.connection = await amqp.connect({
          protocol: "amqp",
          hostname: "localhost", // ou o endereço IP do servidor RabbitMQ
          port: 5672, // Porta padrão do RabbitMQ
          username: "gustavo", // Usuário criado
          password: "123", // Senha do usuário
          vhost: "/", // Virtual host (por padrão é '/')
        });

        this.channel = await this.connection.createChannel();
        console.log("RabbitMQ Channel and Connection Initialized");
      } catch (error) {
        console.error("Erro ao inicializar RabbitMQ:", error);
        throw error; // Re-throw the error to prevent further execution
      }
    }
  }

  public async createExchange(
    exchangeName: string,
    exchangeType: string = "direct"
  ) {
    if (!this.channel) {
      console.error("Canal não está inicializado.");
      return;
    }

    try {
      await this.channel.assertExchange(exchangeName, exchangeType, {
        durable: true,
      });
      console.log(
        `Exchange "${exchangeName}" do tipo "${exchangeType}" criada.`
      );
    } catch (error) {
      console.error("Erro ao criar a exchange:", error);
    }
  }

  public async createQueue(queueName: string, dlxName: string | null = null) {
    if (!this.channel) {
      console.error("Canal não está inicializado.");
      return;
    }

    try {
      const queueOptions = {
        durable: true,
        ...(dlxName && { arguments: { "x-dead-letter-exchange": dlxName } }),
      };

      await this.channel.assertQueue(queueName, queueOptions);
      console.log(`Fila "${queueName}" criada com sucesso.`);

      if (dlxName) {
        console.log(
          `Dead Letter Exchange "${dlxName}" configurado para a fila "${queueName}".`
        );
      }
    } catch (error) {
      console.error("Erro ao criar a fila:", error);
    }
  }

  public async createBinding(
    queueName: string,
    exchangeName: string,
    routingKey: string = ""
  ) {
    if (!this.channel) {
      console.error("Canal não está inicializado.");
      return;
    }

    try {
      await this.channel.bindQueue(queueName, exchangeName, routingKey);
      console.log(
        `Binding criado entre a fila "${queueName}" e o exchange "${exchangeName}" com a routing key "${routingKey}".`
      );
    } catch (error) {
      console.error("Erro ao criar o binding:", error);
    }
  }

  public async publishToExchange(
    exchangeName: string,
    routingKey: string,
    response_routingKey: string,
    message: Record<string, any> | string | Buffer,
    correlationId: string,
    replyTo: string
  ) {
    if (!this.channel) {
      console.error("Canal não está inicializado.");
      return;
    }

    try {
      this.channel.publish(
        exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          contentType: "application/json",
          correlationId: correlationId,
          replyTo: replyTo,
          headers: {
            customRoutingKey: response_routingKey, // Inclui a routingKey como um header customizado
          },
        }
      );

      console.log(
        `Mensagem enviada para a exchange "${exchangeName}" com a routing key "${routingKey}", correlationId: "${correlationId}"`
      );
    } catch (error) {
      console.error("Erro ao enviar mensagem para a exchange:", error);
    }
  }

  public async listenForResponse(
    queueName: string,
    correlationId: string,
    isListening: { value: boolean }
  ): Promise<any> {
    if (!this.channel) {
      console.error("Canal não está inicializado.");
      return;
    }

    return new Promise(async (resolve, reject) => {
      const interval = 100; // Intervalo de tempo (em milissegundos) entre cada tentativa de obtenção da mensagem
      const checkMessage = async () => {
        if (!isListening.value) {
          return; // Interrompe o loop se a escuta foi cancelada
        }

        try {
          const msg = await this.channel.get(queueName, { noAck: false });

          if (msg) {
            const msgCorrelationId = msg.properties.correlationId;

            if (!msgCorrelationId) {
              console.log(
                "Mensagem sem correlationId encontrada. Ignorando..."
              );
              this.channel.nack(msg, false, false); // Não reencaminha a mensagem à fila
            } else if (msgCorrelationId === correlationId) {
              const response = JSON.parse(msg.content.toString());
              this.channel.ack(msg); // Confirma o processamento da mensagem
              resolve(response);
              return; // Finaliza o loop ao encontrar a mensagem correta
            } else {
              console.log(
                "CorrelationId não corresponde. Continuando a ouvir..."
              );
              this.channel.nack(msg, false, true); // Reinsere a mensagem na fila
            }
          }

          // Aguarda um pequeno intervalo antes de tentar novamente
          if (isListening.value) {
            setTimeout(checkMessage, interval);
          }
        } catch (error) {
          console.log(error);
          reject(error);
        }
      };

      checkMessage(); // Inicia a verificação das mensagens
    });
  }
}
