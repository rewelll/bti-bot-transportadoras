// Variaveis JSON
const parser = $('Parser numero/mensagem').item.json;
const rawSession = $('Get last session').first().json || {};
const rawTasks = $('Get active tasks').all();

// Currents
const currentState = rawSession?.state;
const currentTaskId = rawSession?.task_id || null;
const currentTask = rawTasks?.find(task => task.json.id === currentTaskId).json || {};
const nfe = currentTask?.nfe || null;

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

const menus = {};

// menu principal
menus.main = buildList(
  "Escolha uma das opções abaixo:",
  null,
  [
    { id: "0", title: "Entregas", description: "Ver e escolher entrega." },
    { id: "1", title: "Status", description: "Atualizar status" },
    { id: "2", title: "Cancelar", description: "Cancelar atendimento" }
  ]
);

// lista de entregas (taskList vem mais acima no seu script)
menus.entregas = buildList(
  "Entregas pendentes",
  "Selecione uma das opções abaixo",
  taskList
);

menus.cancel = buildText("Atendimento cancelado. Obrigado!");

// confirma tarefa (array: texto + lista)
menus.confirma_tarefa = [
  buildText(`Tarefa selecionada:\n${(currentTask && currentTask.address) ? currentTask.address : 'Endereço não informado'}\nID: ${(currentTask && currentTask.id) ? currentTask.id : '—'}`),
  buildList(
    "Confirma que essa é a tarefa escolhida?",
    "Selecione abaixo",
    [
      { id: "0", title: "Sim", description: null },
      { id: "1", title: "Não", description: null }
    ]
  )
];

menus.status_entrega = buildList(
  "Escolha o Tipo de Entrega",
  "Selecione uma das opções abaixo:",
  [
    { id: "0", title: "Sucesso", description: "Entrega realizada" },
    { id: "1", title: "Pendência", description: "Entrega com pendência" },
    { id: "2", title: "Insucesso", description: "Entrega não realizada" },
    { id: "3", title: "Voltar", description: "Retornar ao menu principal" },
    { id: "4", title: "Cancelar", description: "Cancelar atendimento" }
  ]
);

// definir confirmação da NF como função (retorna um interactive list)
menus.sucesso_confirma = function(nf) {
  const safeNf = nf ? String(nf) : '—';
  return buildList(
    "Confirma os dados da NF?",
    `NF: ${safeNf}\nRemetente: (consultado no ERP)\nDestinatário: (consultado no ERP)`,
    [
      { id: "0", title: "Sim", description: null },
      { id: "1", title: "Não", description: null }
    ]
  );
};

// sucesso_inicial: sempre retorna um array (consistente com reply)
menus.sucesso_inicial = function() {
  const nfe = (currentTask && currentTask.nfe) ? String(currentTask.nfe) : null;
  if (nfe) {
    return [
      buildText(`Nota fiscal vinculada à tarefa: ${nfe}`),
      menus.sucesso_confirma(nfe)
    ];
  } else {
    return [ buildText("Por favor, informe o número da NF para continuar.") ];
  }
};

// menus de pendência
menus.pendencia_tipo = buildList(
  "Informe o tipo de pendência:",
  "Selecione uma das opções abaixo:",
  [
    { id: "0", title: "Avaria" },
    { id: "1", title: "Falta" },
    { id: "2", title: "Inversão/Troca de volumes" }
  ]
);

menus.pendencia_total = buildList(
  "A pendência é total ou parcial?",
  "Selecione uma das opções abaixo:",
  [
    { id: "0", title: "Total" },
    { id: "1", title: "Parcial" }
  ]
);

// menus de insucesso
menus.insucesso_tipo = buildList(
  "Informe o motivo do insucesso:",
  "Selecione uma das opções abaixo:",
  [
    { id: "0", title: "Comprovante Retido" },
    { id: "1", title: "Divergência Comercial" },
    { id: "2", title: "Endereço não localizado" },
    { id: "3", title: "Destinatário ausente" },
    { id: "4", title: "Recusa/Impossibilidade" }
  ]
);


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
                            reply: [buildText(`Status da tarefa ${currentTaskId} alterado para: "Em andamento"`), buildGMapsButton(currentTask.latitude, currentTask.longitude)],
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
      switch (String(interactive_id)) {
        case '0':
          // usa menu contextual: se task tiver nfe, vai mostrar e confirmar;
          // se não tiver, pede pra digitar (menus.sucesso_inicial retorna array/obj)
          return { next: 'ENTREGA_SUCESSO', reply: menus.sucesso_inicial() };

        case '1':
          return { next: 'ENTREGA_PENDENCIA_TIPO', reply: menus.pendencia_tipo };
        case '2':
          return { next: 'ENTREGA_INSUCESSO_TIPO', reply: menus.insucesso_tipo };
        case '3':
          return { next: 'MENU_ENTREGAS', reply: menus.entregas };
        case '4':
          return { next: 'FINISHED', reply: menus.cancel, task_id: null };
        default:
          return { next: 'STATUS_ENTREGA', reply: buildText("Selecione uma opção válida.") };
      }
    }
    return { next: 'STATUS_ENTREGA', reply: menus.status_entrega, incRetry: true };
  }
},

ENTREGA_PENDENCIA_TIPO: {
  action: () => {
    if (inputType === 'interactive') {
      return {
        next: 'ENTREGA_PENDENCIA_TOTALIDADE',
        reply: menus.pendencia_total,
        context_patch: { tipo_pendencia: interactive_id }
      };
    }
    return { next: 'ENTREGA_PENDENCIA_TIPO', reply: menus.pendencia_tipo };
  }
},

ENTREGA_PENDENCIA_TOTALIDADE: {
  action: () => {
    if (inputType === 'interactive') {
      return {
        next: 'ENTREGA_PENDENCIA_FOTO',
        reply: buildText("Envie a foto da NFD, ressalva ou volumes invertidos."),
        context_patch: { totalidade: interactive_id }
      };
    }
    return { next: 'ENTREGA_PENDENCIA_TOTALIDADE', reply: menus.pendencia_total };
  }
},

ENTREGA_PENDENCIA_FOTO: {
  action: () => {
    if (inputType === 'image' || inputType === 'document') {
      return {
        next: 'ENTREGA_PENDENCIA_NOME',
        reply: buildText("Informe o nome do recebedor.")
      };
    }
    return { next: 'ENTREGA_PENDENCIA_FOTO', reply: buildText("Aguardando foto.") };
  }
},

ENTREGA_PENDENCIA_NOME: {
  action: () => {
    if (inputType === 'text') {
      return {
        next: 'FINISHED',
        reply: buildText("Ocorrência registrada. Retornar carga para unidade."),
        status: 3,
        window_end: nowISO(),
        active: false
      };
    }
    return { next: 'ENTREGA_PENDENCIA_NOME', reply: buildText("Informe o nome do recebedor.") };
  }
},

ENTREGA_INSUCESSO_TIPO: {
  action: () => {
    if (inputType === 'interactive') {
      const motivos = [
        "Comprovante Retido",
        "Divergência Comercial",
        "Endereço não localizado",
        "Destinatário ausente",
        "Recusa/Impossibilidade"
      ];
      return {
        next: 'ENTREGA_INSUCESSO_INTERACAO',
        reply: buildText(`Motivo selecionado: ${motivos[parseInt(interactive_id)]}\nA torre será notificada.`),
        context_patch: { motivo_insucesso: motivos[parseInt(interactive_id)] }
      };
    }
    return { next: 'ENTREGA_INSUCESSO_TIPO', reply: menus.insucesso_tipo };
  }
},

ENTREGA_INSUCESSO_INTERACAO: {
  action: () => ({
    next: 'ENTREGA_INSUCESSO_FINAL',
    reply: buildText("Aguarde, a torre entrará em contato com o cliente (prazo: até 20 minutos).")
  })
},

ENTREGA_INSUCESSO_FINAL: {
  action: () => ({
    next: 'FINISHED',
    reply: buildText("Ocorrência registrada. Retornar carga para unidade."),
    status: 4,
    window_end: nowISO(),
    active: false
  })
},

ENTREGA_SUCESSO: {
  action: () => {
    // pega NF vinculada à tarefa (se existir)
    const nfeTask = (currentTask && currentTask.nfe) ? String(currentTask.nfe) : null;

    // Se já houver NF na task, pular para confirmação
    if (nfeTask) {
      return {
        next: 'ENTREGA_SUCESSO_CONFIRMA',
        reply: menus.sucesso_confirma(nfeTask),
        context_patch: { nf: nfeTask }
      };
    }

    // Caso não haja NF vinculada, aguarda texto com a NF digitada
    if (inputType === 'text') {
      const nfDigitada = (text || "").replace(/\D/g, "");
      if (!nfDigitada) {
        return { next: 'ENTREGA_SUCESSO', reply: buildText("Informe o número da NF (apenas números)."), incRetry: true };
      }
      // grava no contexto e vai para confirmação
      return {
        next: 'ENTREGA_SUCESSO_CONFIRMA',
        reply: menus.sucesso_confirma(nfDigitada),
        context_patch: { nf: nfDigitada }
      };
    }

    // padrão
    return { next: 'ENTREGA_SUCESSO', reply: buildText("Por favor, informe o número da NF.") };
  }
},

ENTREGA_SUCESSO_CONFIRMA: {
  action: () => {
    if (inputType === 'interactive') {
      if (interactive_id === '0') {
        return {
          next: 'ENTREGA_SUCESSO_FOTO',
          reply: buildText("Envie a foto do comprovante (deve conter nome, data e carimbo).")
        };
      } else {
        return {
          next: 'MENU_MAIN',
          reply: buildText("Documento não localizado. Contate a unidade."),
          active: false
        };
      }
    }
    return { next: 'ENTREGA_SUCESSO_CONFIRMA', reply: buildText("Selecione uma opção.") };
  }
},

ENTREGA_SUCESSO_FOTO: {
  action: () => {
    if (inputType === 'image' || inputType === 'document') {
      return {
        next: 'ENTREGA_SUCESSO_NOME',
        reply: buildText("Informe o nome do recebedor.")
      };
    }
    return { next: 'ENTREGA_SUCESSO_FOTO', reply: buildText("Aguardando foto do comprovante.") };
  }
},

ENTREGA_SUCESSO_NOME: {
  action: () => {
    if (inputType === 'text') {
      return {
        next: 'FINISHED',
        reply: buildText("Entrega registrada com sucesso. Obrigado!"),
        status: 2,
        window_end: nowISO(),
        active: false
      };
    }
    return { next: 'ENTREGA_SUCESSO_NOME', reply: buildText("Informe o nome do recebedor.") };
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
