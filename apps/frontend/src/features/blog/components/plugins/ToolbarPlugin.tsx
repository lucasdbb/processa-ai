import React, { useEffect, useState, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getNodeByKey
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode } from '@lexical/rich-text';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode
} from '@lexical/list';
import { TOGGLE_LINK_COMMAND, $isLinkNode, $isAutoLinkNode } from '@lexical/link';
import {
  Bold,
  Italic,
  Underline,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Type,
  Link as LinkIcon
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [blockType, setBlockType] = useState('paragraph');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const element = anchorNode.getKey() === 'root'
        ? anchorNode
        : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);
      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNodeByKey<ListNode>(elementKey);
          const type = parentList ? parentList.getListType() : element.getListType();
          setBlockType(type);
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : element.getType();
          setBlockType(type);
        }
      }
      // Update text format
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsCode(selection.hasFormat('code'));
      
      // Check for link
      const node = selection.anchor.getNode();
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isAutoLinkNode(parent)) {
        setIsLink(true);
      } else {
        setIsLink(false);
      }
    }
  }, [editor]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      (_payload, _newEditor) => {
        updateToolbar();
        return false;
      },
      1,
    );
  }, [editor, updateToolbar]);

  useEffect(() => {
    return editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false;
      },
      1,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false;
      },
      1,
    );
  }, [editor]);

  const formatHeading = (tag: 'h1' | 'h2' | 'h3') => {
    if (blockType !== tag) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(tag));
        }
      });
    }
  };

  const formatParagraph = () => {
    if (blockType !== 'paragraph') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    }
  };

  const formatQuote = () => {
    if (blockType !== 'quote') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    }
  };

  const formatBulletList = () => {
    if (blockType !== 'ul') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const formatNumberedList = () => {
    if (blockType !== 'ol') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const insertLink = useCallback(() => {
    if (!isLink) {
      const url = prompt('Digite a URL do link:');
      if (!url) return;
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  const ToolbarButton = ({ 
    onClick, 
    icon: Icon, 
    title,
    active = false,
    disabled = false
  }: { 
    onClick: () => void; 
    icon: React.ElementType; 
    title: string;
    active?: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-2 rounded-lg transition-all",
        active 
          ? "bg-primary-100 text-primary-700" 
          : "hover:bg-gray-100 text-gray-600 hover:text-gray-900",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-gray-200 mx-1" />;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-100 bg-white sticky top-0 z-10">
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          icon={Undo}
          title="Desfazer"
          disabled={!canUndo}
        />
        <ToolbarButton
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          icon={Redo}
          title="Refazer"
          disabled={!canRedo}
        />
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={formatParagraph}
          icon={Type}
          title="Normal"
          active={blockType === 'paragraph'}
        />
        <ToolbarButton
          onClick={() => formatHeading('h1')}
          icon={Heading1}
          title="Título 1"
          active={blockType === 'h1'}
        />
        <ToolbarButton
          onClick={() => formatHeading('h2')}
          icon={Heading2}
          title="Título 2"
          active={blockType === 'h2'}
        />
        <ToolbarButton
          onClick={() => formatHeading('h3')}
          icon={Heading3}
          title="Título 3"
          active={blockType === 'h3'}
        />
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
          icon={Bold}
          title="Negrito"
          active={isBold}
        />
        <ToolbarButton
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
          icon={Italic}
          title="Itálico"
          active={isItalic}
        />
        <ToolbarButton
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
          icon={Underline}
          title="Sublinhado"
          active={isUnderline}
        />
        <ToolbarButton
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
          icon={Code}
          title="Código"
          active={isCode}
        />
        <ToolbarButton
          onClick={insertLink}
          icon={LinkIcon}
          title="Inserir Link"
          active={isLink}
        />
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
          icon={AlignLeft}
          title="Alinhar Esquerda"
        />
        <ToolbarButton
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
          icon={AlignCenter}
          title="Centralizar"
        />
        <ToolbarButton
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
          icon={AlignRight}
          title="Alinhar Direita"
        />
      </div>

      <Divider />

      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={formatBulletList}
          icon={List}
          title="Lista"
          active={blockType === 'ul'}
        />
        <ToolbarButton
          onClick={formatNumberedList}
          icon={ListOrdered}
          title="Lista Numerada"
          active={blockType === 'ol'}
        />
        <ToolbarButton
          onClick={formatQuote}
          icon={Quote}
          title="Citação"
          active={blockType === 'quote'}
        />
      </div>
    </div>
  );
}
