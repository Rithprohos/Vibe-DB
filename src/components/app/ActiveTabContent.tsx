import { lazy, Suspense, type ReactNode } from 'react';
import EmptyTabScreen from '../EmptyTabScreen';
import WelcomeScreen from '../WelcomeScreen';
import { useActiveTab, useAppStore, type AppState } from '../../store/useAppStore';
import type { ConnectionProgressState } from '../../hooks/useAppConnectionManager';
import ConnectionRestoreLoading from './ConnectionRestoreLoading';

const TableView = lazy(() => import('../TableView/index'));
const QueryEditor = lazy(() => import('../QueryEditor'));
const CreateTable = lazy(() => import('../CreateTable'));
const CreateView = lazy(() => import('../CreateView'));
const CreateEnum = lazy(() => import('../CreateEnum'));
const EnumDetail = lazy(() => import('../EnumDetail'));
const EditTable = lazy(() => import('../EditTable'));
const TableStructure = lazy(() => import('../TableStructure'));
const SchemaVisualization = lazy(() => import('../SchemaVisualization'));

const selectIsConnected = (state: AppState) => state.isConnected;

function ContentLoading() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
      <span className="text-sm font-medium tracking-wide">Loading view...</span>
    </div>
  );
}

function renderLazyView(view: ReactNode) {
  return <Suspense fallback={<ContentLoading />}>{view}</Suspense>;
}

interface ActiveTabContentProps {
  startupRestoreChecked: boolean;
  connectionProgress: ConnectionProgressState | null;
}

export default function ActiveTabContent({
  startupRestoreChecked,
  connectionProgress,
}: ActiveTabContentProps) {
  const activeTab = useActiveTab();
  const isConnected = useAppStore(selectIsConnected);

  if (connectionProgress) {
    return (
      <ConnectionRestoreLoading
        startupCheckPending={!startupRestoreChecked}
        progress={connectionProgress}
      />
    );
  }

  if (!isConnected) {
    if (!startupRestoreChecked) {
      return (
        <ConnectionRestoreLoading
          startupCheckPending={!startupRestoreChecked}
          progress={connectionProgress}
        />
      );
    }

    return <WelcomeScreen />;
  }

  if (!activeTab) {
    return <EmptyTabScreen />;
  }

  switch (activeTab.type) {
    case 'data':
      return activeTab.tableName
        ? renderLazyView(
            <TableView key={activeTab.id} tableName={activeTab.tableName} tabId={activeTab.id} />,
          )
        : <EmptyTabScreen />;
    case 'structure':
      return activeTab.tableName
        ? renderLazyView(
            <TableStructure key={activeTab.id} tableName={activeTab.tableName} tabId={activeTab.id} />,
          )
        : <EmptyTabScreen />;
    case 'visualize':
      return renderLazyView(<SchemaVisualization key={activeTab.id} tabId={activeTab.id} />);
    case 'query':
      return renderLazyView(<QueryEditor key={activeTab.id} tabId={activeTab.id} />);
    case 'create-table':
      return renderLazyView(<CreateTable key={activeTab.id} tabId={activeTab.id} />);
    case 'create-view':
      return renderLazyView(<CreateView key={activeTab.id} tabId={activeTab.id} />);
    case 'create-enum':
      return renderLazyView(<CreateEnum key={activeTab.id} tabId={activeTab.id} />);
    case 'enum-detail':
      return renderLazyView(<EnumDetail key={activeTab.id} tabId={activeTab.id} />);
    case 'edit-table':
      return activeTab.tableName
        ? renderLazyView(
            <EditTable key={activeTab.id} tableName={activeTab.tableName} tabId={activeTab.id} />,
          )
        : <EmptyTabScreen />;
    default:
      return <EmptyTabScreen />;
  }
}
