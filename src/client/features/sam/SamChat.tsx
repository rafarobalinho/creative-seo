// Creative SEO: useLocation lê o pedido de relatório (creative/DECISOES.md, regra 13).
import { Link, useLocation } from "@tanstack/react-router";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Brain } from "lucide-react";
import { QueryError } from "@/client/components/QueryState";
import { StatusScreen } from "@/client/components/StatusScreen";
import { Button } from "@/client/components/ui/button";
import { useSamAccess } from "./useSamAccess";
import { useSamSessions } from "./useSamSessions";
import { optInToSamBeta, useSamBetaOptIn } from "./samBetaOptIn";
import { SamBetaGate } from "./SamBetaGate";
import { SamSetupGate } from "./SamSetupGate";
import { SamConversation } from "./SamConversation";
// Creative SEO: pouso e chave do pedido de relatório (creative/DECISOES.md, regra 13).
import {
  ESTADO_DO_PEDIDO,
  decidirPouso,
} from "@/client/features/creative/pedidoDeRelatorio";

/**
 * The SAM route's content: the active conversation, full-width. The chat
 * history list lives in the app sidebar's Chat tab (SamSidebarPanel); this
 * component gates on the beta opt-in, then lands the user in the most recent
 * session, creating one when the project has none.
 */
export function SamChat({
  projectId,
  activeSessionId,
}: {
  projectId: string;
  activeSessionId: string | undefined;
}) {
  const optedIn = useSamBetaOptIn();
  const access = useSamAccess(projectId);

  // The ref (not isPending) guards the auto-create below: React can re-run the
  // effect before the mutation state updates, and it resets on settle so
  // archiving the last chat starts a fresh one.
  const creating = useRef(false);
  // Kept in state: the mutation's own callbacks fire for the create started
  // from the effect below, but the hook's `isError` can miss it and leave the
  // spinner up.
  const [createError, setCreateError] = useState<Error | null>(null);
  const { sessionsQuery, sessions, goToSession, createSession } =
    useSamSessions(projectId, {
      replace: true,
      onCreateError: setCreateError,
      onCreateSettled: () => {
        creating.current = false;
      },
    });
  // Creative SEO: o pedido de relatório chega no estado de navegação e ganha
  // conversa nova (creative/DECISOES.md, regra 13). O ref guarda o texto
  // porque a navegação `replace` do goToSession limpa o estado; é essa
  // limpeza que impede o reenvio ao recarregar.
  const pedidoNoEstado = useLocation({
    select: (location) => location.state[ESTADO_DO_PEDIDO],
  });
  const pedido = useRef<string | undefined>(undefined);
  if (pedidoNoEstado !== undefined) pedido.current = pedidoNoEstado;
  // Só a conversa criada para o pedido o recebe, nunca uma antiga.
  const [pedidoDaConversa, setPedidoDaConversa] = useState<{
    sessionId: string;
    texto: string;
  }>();
  const limparPedido = useCallback(() => {
    pedido.current = undefined;
    setPedidoDaConversa(undefined);
  }, []);

  const { mutate: createSessionMutate, mutateAsync: createSessionAsync } =
    createSession;
  const startChat = useCallback(() => {
    creating.current = true;
    setCreateError(null);
    const texto = pedido.current;
    if (texto === undefined) {
      createSessionMutate();
      return;
    }
    // O erro já chega a setCreateError pelo onError do hook.
    createSessionAsync().then(
      ({ id }) => setPedidoDaConversa({ sessionId: id, texto }),
      () => {},
    );
  }, [createSessionMutate, createSessionAsync]);

  // Landing without a session: open the most recent one, or start a fresh
  // chat when the project has none.
  const firstSessionId = sessions[0]?.id;
  useEffect(() => {
    if (!optedIn || access.status !== "ready") return;
    const pouso = decidirPouso({
      temPedido: pedidoNoEstado !== undefined,
      sessaoAtiva: activeSessionId,
      primeiraSessao: firstSessionId,
    });
    if (pouso === "nada") return;
    if (pouso === "abrir-primeira" && firstSessionId) {
      goToSession(firstSessionId);
      return;
    }
    if (!sessionsQuery.isSuccess || creating.current) return;
    startChat();
  }, [
    activeSessionId,
    optedIn,
    access.status,
    firstSessionId,
    pedidoNoEstado,
    sessionsQuery.isSuccess,
    goToSession,
    startChat,
  ]);

  // The list holds every chat the user can open, so an id missing from it is
  // archived, deleted, or not theirs. The cached list can predate the link,
  // though (a chat started in another tab), so refetch once before saying so.
  const activeSession = sessions.find(
    (session) => session.id === activeSessionId,
  );
  // Gated on the cached list, not on isSuccess: a failed refetch keeps the
  // old list but leaves the query in error.
  const isMissing =
    activeSessionId !== undefined &&
    !activeSession &&
    sessionsQuery.data !== undefined;
  const [recheckedSessionId, setRecheckedSessionId] = useState<string>();
  const { refetch: refetchSessions } = sessionsQuery;
  useEffect(() => {
    if (!isMissing || recheckedSessionId === activeSessionId) return;
    void refetchSessions().finally(() =>
      setRecheckedSessionId(activeSessionId),
    );
  }, [isMissing, recheckedSessionId, activeSessionId, refetchSessions]);

  if (!optedIn) {
    return (
      <StatusScreen>
        <SamBetaGate onContinue={optInToSamBeta} />
      </StatusScreen>
    );
  }

  if (access.status === "checking") {
    return <StatusScreen pending />;
  }

  if (access.status === "error") {
    return (
      <StatusScreen>
        <QueryError
          error={access.error}
          fallback="Could not load AI agent setup status."
          onRetry={access.onRetry}
          isRetrying={access.isRetrying}
        />
      </StatusScreen>
    );
  }

  // SAM cannot answer a turn without OPENROUTER_API_KEY, so surface setup
  // instructions instead of letting a chat fail mid-stream (self-hosted only).
  if (access.status === "setup") {
    return (
      <StatusScreen size="lg">
        <SamSetupGate
          errorMessage={access.errorMessage}
          isRefetching={access.isRefetching}
          onRetry={access.onRetry}
        />
      </StatusScreen>
    );
  }

  if (!activeSessionId) {
    // Sessions are loading or a fresh chat is being created; the effect above
    // redirects into it. Either request can fail, and neither retries itself.
    const loadFailed = sessionsQuery.isError && !sessionsQuery.data;
    return (
      <StatusScreen pending={!loadFailed && !createError}>
        {loadFailed ? (
          <QueryError
            error={sessionsQuery.error}
            fallback="Failed to load your chats."
            onRetry={() => void sessionsQuery.refetch()}
            isRetrying={sessionsQuery.isFetching}
          />
        ) : createError ? (
          <QueryError
            error={createError}
            fallback="Failed to start a new chat."
            onRetry={startChat}
          />
        ) : null}
      </StatusScreen>
    );
  }

  // Never open a chat the list has not confirmed. Wait for the list and the
  // one refetch, show the list error if either fails, else say it is gone.
  if (!activeSession) {
    const confirmed =
      sessionsQuery.data !== undefined &&
      recheckedSessionId === activeSessionId;
    if (sessionsQuery.isFetching || (!confirmed && !sessionsQuery.isError)) {
      return <StatusScreen pending />;
    }
    if (sessionsQuery.isError) {
      return (
        <StatusScreen>
          <QueryError
            error={sessionsQuery.error}
            fallback="Failed to load your chats."
            onRetry={() => void refetchSessions()}
          />
        </StatusScreen>
      );
    }
    return (
      <StatusScreen description="This chat was archived or does not exist.">
        <Button onClick={() => goToSession()}>Go to your latest chat</Button>
      </StatusScreen>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Session title + the shortest path to inspect or correct the shared
          memory SAM reads and writes during the conversation. */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <span className="truncate text-sm font-medium text-foreground/80">
          {activeSession.title}
        </span>
        <Link
          to="/p/$projectId/context"
          params={{ projectId }}
          className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Brain className="size-3.5" />
          Project memory
        </Link>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* useAgentChat suspends while it fetches the session's history; this
            boundary keeps that suspension inside the chat panel instead of
            letting it bubble up and swap out the whole shell — which read as
            a full page refresh on every session switch. */}
        <Suspense fallback={<StatusScreen pending />}>
          <SamConversation
            key={activeSessionId}
            projectId={projectId}
            sessionId={activeSessionId}
            pedidoInicial={
              pedidoDaConversa?.sessionId === activeSessionId
                ? pedidoDaConversa.texto
                : undefined
            }
            aoEnviarPedido={limparPedido}
          />
        </Suspense>
      </div>
    </div>
  );
}
