// Variaveis JSON
const parser = $('Parser numero/mensagem').item.json;
const rawSession = $('Get last session').first().json || {};
const rawTasks = $('Get active tasks').all();

// Currents
const currentState = rawSession?.state;
const currentTaskId = rawSession?.task_id || null;
const currentTask = rawTasks?.find(task => task.json.id === currentTaskId).json || {};

// Array com itens das tarefas para a listagem no whats
const tasks = rawTasks.map(task => {
  if (!task || !task.json) return null;
  
  return {
    json: {
      id: task.json.id,
      address: task.json.address,
      task_type: (task.json.task_type === 0) ? "Entrega" : task.json.task_type,
      notes: task.json.notes
    }
  };
}).filter(task => task !== null);


// Variaveis sessão whatsapp
const wa_id = parser?.parsedPhoneNumber;
const inputType = parser?.type || 'text';
const rawText = (parser?.text || '').toString();
const text = rawText.trim();
const interactive_id = parser?.interactive_id ?? null;

// Helper para timestamps
function nowISO() {
  return new Date().toISOString();
}

// Cria textos
function buildText(body) {
  return {
    messaging_product: "whatsapp",
    to: wa_id,
    type: "text",
    text: { body }
  };
}

// Cria menus
function buildList(header, body, rows) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: wa_id,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: header },
      body: { text: body },
      footer: { text: "Sistema de Atendimento" },
      action: { button: "Selecionar", sections: [{ title: "Opções", rows }] }
    }
  };
}

// Envia localização da entrega em link do Google Maps

function buildGMapsButton(lat, long) {
    return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: wa_id,
        type: "interactive",
        interactive: {
            type: "cta_url",
            header: {
                type: "image",
                image: {
                    link: "https://imgs.search.brave.com/7BV5guWdnPQwT3ePhZCVvQcvKn3yLTtdJmO4W2Fy1OE/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly93d3cu/c2xhc2hnZWFyLmNv/bS9pbWcvZ2FsbGVy/eS90aGUtMTAtYmVz/dC1nb29nbGUtbWFw/cy1zdHJlZXQtdmll/dy1waG90b3Mtb2Yt/YWxsLXRpbWUvaW50/cm8tMTY1NDYyNzEy/My5qcGc"
                } // Imagem genérica do app do google maps só pra deixar um header bonitinho
            },
            body: {
                text: "Clique no link para abrir o endereço no Google Maps."
            },
            action: {
                name: "cta_url",
                parameters: {
                    display_text: "Abrir no Google Maps",
                    url: `https://www.google.com/maps/dir//${lat},${long}`
                }
            }
        }
    }
}

// Variavel helper pro menu entregas

let taskList = tasks.map((task, index) => {
            return {
                json: {
                    id: index,
                    title: task.json.address,
                    description: task.json.id
                }
            };
        });

taskList.push([{
    json: {
        id: taskList.length,
        title: "Voltar", 
        description: "Retornar ao menu principal"
    }
},
{
    json: {
        id: (taskList.length + 1),
        title: "Cancelar", 
        description: "Cancelar atendimento."
    }
}
]);

// Menus
const menus = {
    main: buildList(
        "Escolha uma das opções abaixo:",
        null,
        [
        { id: "0", title: "Entregas", description: "Ver e escolher entrega." },
        { id: "1", title: "Status", description: "Atualizar status" },
        { id: "2", title: "Cancelar", description: "Cancelar atendimento" }
        ]
    ),
    entregas: buildList(
        "Entregas pendentes",
        "Selecione uma das opções abaixo",
        taskList
    ),

    cancel: buildText("Atendimento cancelado. Obrigado!"),

    confirma_tarefa: [buildText(`Tarefa selecionada:\n
            ${currentTask.json.address}\n
            ${currentTask.json.id}`),
        buildList(
        "Confirma que essa é a tarefa escolhida?",
        "Selecione abaixo",
        [
        {id: "0", title: "Sim", description:null},
        {id: "1", title: "Não", description:null}
        ]
    )
    ],
    status_entrega: buildList(
        "Escolha o Tipo de Entrega",
        "Selecione uma das opções abaixo:",
            [
            { id: "0", title: "Sucesso", description: "Entrega realizada" },
            { id: "1", title: "Pendência", description: "Entrega com pendência" },
            { id: "2", title: "Insucesso", description: "Entrega não realizada" },
            { id: "3", title: "Voltar", description: "Retornar ao menu principal" },
            { id: "4", title: "Cancelar", description: "Cancelar atendimento" }
            ]
        )
    
};


// State Mapping
const stateMap = {
    MENU_MAIN: {
        action: () => {
            if (inputType === 'interactive') {
                switch (String(interactive_id)) {
                    case '0':
                        return {
                            next: 'MENU_ENTREGAS',
                            reply: menus.entregas
                        };

                    case '1' :
                        switch (currentTaskId) {
                            case true:
                                return {
                                    next: 'STATUS_ENTREGA',
                                    reply: menus.status_entrega
                                };
                            case false:
                                return {
                                        next: 'MENU_ENTREGAS',
                                        reply: [buildText("Nenhuma tarefa em andamento. Escolha uma nova:"), menus.entregas]
                                };
                        }
                        
                    case '2':
                        return {
                            next: 'FINISHED',
                            reply: menus.cancel,
                            active: false
                        };

                    default:
                        return { next: 'MENU_MAIN', reply: buildText("Opção inválida. Por favor, selecione do menu."), incRetry: true };
                }
            }else{
                return { next: 'MENU_MAIN', reply: buildText("Por favor, selecione uma opção do menu."), incRetry: true };
            }
        }
    },

    MENU_ENTREGAS: {
        action: () => {
            if (inputType === 'interactive') {
                switch (String(interactive_id)) {
                    case String(taskList.length):
                        return {
                            next: 'MENU_ENTREGAS',
                            reply: menus.entregas
                        };

                    case String(taskList.length+1):
                        return {
                            next: 'MENU_MAIN',
                            reply: menus.main
                        };

                    default:
                        return {
                            next: 'CONFIRMACAO',
                            reply: confirma_tarefa,
                            task_id: tasks[interactive_id].id
                        };
                    }
            }else{
                return { next: 'MENU_ENTREGAS', reply: buildText("Por favor, selecione uma opção do menu."), incRetry: true };
            }
        }
    },

    CONFIRMACAO: {
        action: () => {
            if (inputType === 'interactive') {
                switch (String(interactive_id)){
                    case '0':
                        return {
                            next: 'FINISHED',
                            reply: buildText(`Status da tarefa ${currentTaskId} alterado para: "Em andamento"`),
                            status: 1,
                            window_start: nowISO()
                        };
                    
                    case '1':
                        return {
                            next: 'MENU_ENTREGAS',
                            reply: menus.entregas,
                            task_id: null
                        };
                }
            }else{
                return { next: 'CONFIRMACAO', reply: buildText("Por favor, selecione uma opção do menu."), incRetry: true };
            }
        }
    },

    STATUS_ENTREGA: {
        action: () => {
            if (inputType === 'interactive') {
                switch (String(interactive_id)){
                    case '0':
                        return {
                            next: 'FINISHED',
                            reply: buildText(`Status da tarefa ${currentTaskId} alterado para: "Sucesso"`),
                            status: 2,
                            window_end: nowISO()
                        };
                    
                    case '1':
                        return {
                            next: '',
                            reply: buildText(`Status da tarefa ${currentTaskId} alterado para: "Pendência"`),
                            status: 3,
                            window_start: nowISO()
                        };

                    case '2':
                        return {
                            next: 'FINISHED',
                            reply: buildText(`Status da tarefa ${currentTaskId} alterado para: "Insucesso"`),
                            status: 4,
                            window_start: nowISO()
                        };
                    
                    case '3':
                        return {
                            next: 'MENU_ENTREGAS',
                            reply: menus.entregas
                        };

                    case '4':
                        return {
                            next: 'FINISHED',
                            reply: menus.cancel,
                            task_id: null
                        };
                }
            }else{
                return { next: 'CONFIRMACAO', reply: buildText("Por favor, selecione uma opção do menu."), incRetry: true };
            }
        }
    }
};

// Execução
let result;
try {
  result = stateMap[currentState].action();
} catch (e) {
  result = { next: 'FINISHED', reply: buildText("Erro interno. Encerrando atendimento."), active: false };
}

// Atualiza sessão
const nextState = result.next;
const retries = result.incRetry ? rawSession.retries + 1 : 0;
const active = 'active' in result ? result.active : rawSession.active;

// Atualiza tarefa
const nextTaskId = 'task_id' in result ? result.task_id : currentTask;
const taskStatus = 'task_status' in result ? result.task_status : currentTask.task_status;
const windowStart = 'window_start' in result ? result.window_start : currentTask.window_start;
const windowEnd = 'window_end' in result ? result.window_end : currentTask.window_end;

// Saída
return [{
  json: {
    reply: result.reply,
    session_update: {
      employee_id: rawSession.employee_id,
      state: nextState,
      context,
      retries,
      active,
      last_message_id: message_id,
      task_id: nextTaskId,
      updated_at: nowISO()
    },
    task_update: {
        id: nextTaskId,
        taskStatus,
        windowStart,
        windowEnd
    }
  }
}];
