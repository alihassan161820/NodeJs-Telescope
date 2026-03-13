import { useState } from 'react';

interface JsonViewerProps {
  data: unknown;
  initialExpanded?: boolean;
}

export function JsonViewer({ data, initialExpanded = true }: JsonViewerProps) {
  return (
    <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 font-mono text-sm overflow-auto">
      <JsonNode value={data} depth={0} initialExpanded={initialExpanded} />
    </div>
  );
}

interface JsonNodeProps {
  keyName?: string;
  value: unknown;
  depth: number;
  initialExpanded?: boolean;
  isLast?: boolean;
}

function JsonNode({ keyName, value, depth, initialExpanded = true, isLast = true }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(initialExpanded && depth < 3);
  const indent = depth * 16;

  // Null
  if (value === null) {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-gray-500">null</span>
        {!isLast && <span className="text-gray-600">,</span>}
      </div>
    );
  }

  // Undefined
  if (value === undefined) {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-gray-500">undefined</span>
        {!isLast && <span className="text-gray-600">,</span>}
      </div>
    );
  }

  // String
  if (typeof value === 'string') {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-green-400">"{escapeString(value)}"</span>
        {!isLast && <span className="text-gray-600">,</span>}
      </div>
    );
  }

  // Number
  if (typeof value === 'number') {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-orange-400">{String(value)}</span>
        {!isLast && <span className="text-gray-600">,</span>}
      </div>
    );
  }

  // Boolean
  if (typeof value === 'boolean') {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-red-400">{String(value)}</span>
        {!isLast && <span className="text-gray-600">,</span>}
      </div>
    );
  }

  // Array
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div style={{ paddingLeft: indent }}>
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-gray-400">[]</span>
          {!isLast && <span className="text-gray-600">,</span>}
        </div>
      );
    }

    return (
      <div>
        <div
          style={{ paddingLeft: indent }}
          className="cursor-pointer hover:bg-gray-900/50"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-gray-600 select-none mr-1">{expanded ? '\u25BC' : '\u25B6'}</span>
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-gray-400">[</span>
          {!expanded && (
            <>
              <span className="text-gray-500"> {value.length} items </span>
              <span className="text-gray-400">]</span>
              {!isLast && <span className="text-gray-600">,</span>}
            </>
          )}
        </div>
        {expanded && (
          <>
            {value.map((item, index) => (
              <JsonNode
                key={index}
                value={item}
                depth={depth + 1}
                initialExpanded={initialExpanded}
                isLast={index === value.length - 1}
              />
            ))}
            <div style={{ paddingLeft: indent }}>
              <span className="text-gray-400">]</span>
              {!isLast && <span className="text-gray-600">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  // Object
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      return (
        <div style={{ paddingLeft: indent }}>
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-gray-400">{'{}'}</span>
          {!isLast && <span className="text-gray-600">,</span>}
        </div>
      );
    }

    return (
      <div>
        <div
          style={{ paddingLeft: indent }}
          className="cursor-pointer hover:bg-gray-900/50"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-gray-600 select-none mr-1">{expanded ? '\u25BC' : '\u25B6'}</span>
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-gray-400">{'{'}</span>
          {!expanded && (
            <>
              <span className="text-gray-500"> {entries.length} keys </span>
              <span className="text-gray-400">{'}'}</span>
              {!isLast && <span className="text-gray-600">,</span>}
            </>
          )}
        </div>
        {expanded && (
          <>
            {entries.map(([key, val], index) => (
              <JsonNode
                key={key}
                keyName={key}
                value={val}
                depth={depth + 1}
                initialExpanded={initialExpanded}
                isLast={index === entries.length - 1}
              />
            ))}
            <div style={{ paddingLeft: indent }}>
              <span className="text-gray-400">{'}'}</span>
              {!isLast && <span className="text-gray-600">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ paddingLeft: indent }}>
      {keyName !== undefined && <KeyLabel name={keyName} />}
      <span className="text-gray-400">{String(value)}</span>
      {!isLast && <span className="text-gray-600">,</span>}
    </div>
  );
}

function KeyLabel({ name }: { name: string }) {
  return (
    <>
      <span className="text-purple-400">"{name}"</span>
      <span className="text-gray-500">: </span>
    </>
  );
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
