import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type JSX,
  type ParentComponent,
  type Setter,
} from 'solid-js';

interface RightSidebarState {
  content: Accessor<JSX.Element | null>;
  setContent: Setter<JSX.Element | null>;
}

const RightSidebarContext = createContext<RightSidebarState>();

export const RightSidebarProvider: ParentComponent = (props) => {
  const [content, setContent] = createSignal<JSX.Element | null>(null);
  return (
    <RightSidebarContext.Provider value={{ content, setContent }}>
      {props.children}
    </RightSidebarContext.Provider>
  );
};

export function useRightSidebar(): RightSidebarState {
  const ctx = useContext(RightSidebarContext);
  if (!ctx) throw new Error('useRightSidebar must be used inside RightSidebarProvider');
  return ctx;
}
