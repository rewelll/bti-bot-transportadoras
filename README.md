# Projeto de Automação de Atendimento via WhatsApp

## Visão Geral

Este projeto consiste em um sistema de automação de atendimento ao cliente via WhatsApp, utilizando workflows da plataforma n8n e um banco de dados PostgreSQL para gerenciar as interações e os dados do negócio. O sistema é projetado para lidar com conversas, gerenciar o estado do atendimento e registrar todas as interações para fins de auditoria e análise.

## Componentes

O projeto é composto por três partes principais:

1.  **Banco de Dados**: Um banco de dados PostgreSQL que armazena todas as informações da empresa, clientes, funcionários, veículos, manifestos de transporte, tarefas e interações do WhatsApp.
2.  **Workflow `Bot-contato`**: Um workflow do n8n que funciona como o cérebro do bot do WhatsApp, processando as mensagens recebidas, gerenciando o estado da conversa e respondendo aos usuários.
3.  **Workflow `timer-finisher`**: Um workflow auxiliar do n8n que é executado periodicamente para finalizar sessões de atendimento inativas.

## Estrutura do Banco de Dados

O esquema do banco de dados está definido no arquivo `database.sql`. As principais tabelas são:

*   `company`: Armazena informações sobre as empresas.
*   `unit`: Armazena informações sobre as unidades das empresas.
*   `employee`: Armazena informações sobre os funcionários.
*   `vehicle`: Armazena informações sobre os veículos.
*   `manifest`: Armazena informações sobre os manifestos de transporte.
*   `task`: Armazena informações sobre as tarefas a serem executadas.
*   `task_history`: Armazena o histórico das tarefas.
*   `incident`: Armazena informações sobre as ocorrências.
*   `invoice`: Armazena informações sobre as notas fiscais.
*   `image`: Armazena URLs de imagens associadas a tarefas, manifestos, etc.
*   `log_json`: Armazena logs das interações do WhatsApp em formato JSON.
*   `wa_session`: Gerencia as sessões de atendimento do WhatsApp, incluindo o estado atual e o contexto da conversa.

## Workflows n8n

Os workflows do n8n são o coração da automação. Eles são responsáveis por receber, processar e responder às mensagens do WhatsApp, além de interagir com o banco de dados para buscar e armazenar informações.

### Workflow `Bot-contato`

Este workflow é acionado por um gatilho do WhatsApp sempre que uma nova mensagem é recebida. O fluxo de execução é o seguinte:

1.  **Parser da Mensagem**: A mensagem recebida é processada para extrair informações importantes, como o número de telefone do remetente, o conteúdo da mensagem e o tipo de interação.
2.  **Gerenciamento de Sessão**: O workflow verifica se já existe uma sessão ativa para o usuário. Se não houver, uma nova sessão é criada. Se houver, o estado da sessão é atualizado.
3.  **Máquina de Estados**: O workflow utiliza uma máquina de estados para controlar o fluxo da conversa. Cada estado representa um ponto na interação com o usuário, como o menu principal, a seleção de opções de entrega, o agendamento, etc.
4.  **Interação com o Banco de Dados**: O workflow interage com o banco de dados Supabase para buscar informações (por exemplo, dados do funcionário, detalhes do veículo) e para salvar o progresso da conversa (por exemplo, atualizando o estado da sessão, registrando logs).
5.  **Envio de Respostas**: Com base no estado atual da conversa e na entrada do usuário, o workflow constrói e envia respostas apropriadas via WhatsApp.

### Workflow `timer-finisher`

Este workflow é um processo agendado que é executado a cada 5 minutos. Sua função é garantir que as sessões de atendimento inativas sejam devidamente encerradas. O fluxo de execução é o seguinte:

1.  **Busca por Sessões Inativas**: O workflow consulta o banco de dados para encontrar sessões de WhatsApp que estão ativas, mas não tiveram nenhuma interação nos últimos 10 minutos.
2.  **Finalização da Sessão**: Para cada sessão inativa encontrada, o workflow atualiza o estado da sessão para `FINISHED` e a marca como inativa.

## Configuração e Uso

Para utilizar este projeto, é necessário ter uma instância do n8n e um banco de dados PostgreSQL (como o Supabase) configurados. As credenciais para o Supabase e para a API do WhatsApp devem ser configuradas no n8n.

Os workflows podem ser importados para o n8n a partir dos arquivos JSON fornecidos. O esquema do banco de dados pode ser criado executando o script `database.sql`.




## Detalhes da Estrutura do Banco de Dados

A tabela a seguir resume as principais tabelas do banco de dados e suas finalidades:

| Tabela | Descrição |
| --- | --- |
| `company` | Armazena dados cadastrais das empresas que utilizam o sistema. |
| `unit` | Representa as diferentes unidades ou filiais de uma empresa. |
| `employee` | Contém as informações dos funcionários, incluindo o `wa_id` (ID do WhatsApp) para identificação. |
| `vehicle` | Armazena dados dos veículos associados aos funcionários e às empresas. |
| `manifest` | Gerencia os manifestos de transporte, que agrupam um conjunto de tarefas de entrega. |
| `task` | Descreve as tarefas individuais de entrega ou coleta, vinculadas a um manifesto. |
| `task_history` | Registra o histórico de status e eventos de cada tarefa. |
| `incident` | Armazena os tipos de ocorrências que podem ser registradas durante uma entrega. |
| `invoice` | Contém os dados das notas fiscais associadas às tarefas. |
| `image` | Armazena as URLs de imagens que podem ser anexadas a tarefas, manifestos, etc. |
| `log_json` | Funciona como um log bruto de todas as mensagens (recebidas e enviadas) trocadas via WhatsApp. |
| `wa_session` | Tabela central para o bot, que controla o estado da conversa para cada usuário (`wa_id`). |

## Detalhes dos Workflows

### Máquina de Estados do `Bot-contato`

O coração do `Bot-contato` é uma máquina de estados implementada em um nó de código (JavaScript). Ela gerencia o fluxo da conversa com base no estado atual da sessão do usuário (`wa_session.state`) e na entrada do usuário. Os principais estados são:

*   **START**: O estado inicial de qualquer nova sessão.
*   **MENU_MAIN**: Apresenta o menu principal com as opções de atendimento.
*   **MENU_ENTREGA**: Submenu para detalhar o status de uma entrega (sucesso, pendência, insucesso).
*   **MENU_AGENDAMENTO**: Submenu para agendar uma entrega.
*   **FINISHED**: Estado final de uma sessão, indicando que o atendimento foi concluído.

O workflow utiliza o `context` da sessão (`wa_session.context`) para armazenar informações temporárias durante a conversa, como o nome do funcionário e a placa do veículo.

### Lógica do `timer-finisher`

Este workflow é crucial para a manutenção do sistema. Ele executa uma consulta no Supabase para buscar sessões que estão com `active = true`, mas cuja última atualização (`updated_at`) foi há mais de 10 minutos. Para cada uma dessas sessões, ele executa um `UPDATE` para definir `active = false` e `state = 'FINISHED'`, garantindo que o sistema não tenha sessões "presas" em um estado ativo indefinidamente.

## Fluxo de Atendimento Típico

1.  Um funcionário envia uma mensagem de seu WhatsApp para o número do bot.
2.  O `WhatsApp Trigger` no n8n recebe a mensagem.
3.  O workflow `Bot-contato` é iniciado.
4.  O número do funcionário é verificado no banco de dados (`employee` e `wa_session`).
5.  Se for o primeiro contato ou uma sessão finalizada, um novo menu é apresentado.
6.  Se houver uma sessão em andamento, o bot responde de acordo com o estado atual da conversa.
7.  O funcionário interage com os menus (listas interativas) para registrar o status de uma entrega, agendar um horário, etc.
8.  Cada interação atualiza a tabela `wa_session` e, dependendo da ação, outras tabelas como `task_history` e `log_json`.
9.  Ao final do fluxo, o funcionário pode cancelar ou finalizar o atendimento, ou a sessão pode ser finalizada automaticamente pelo `timer-finisher` após um período de inatividade.

