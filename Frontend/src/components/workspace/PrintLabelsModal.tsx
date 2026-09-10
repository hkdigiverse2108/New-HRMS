"use client";

import React, { useState } from "react";
import { X, Printer, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PrintLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  resources: any[];
}

export function PrintLabelsModal({ isOpen, onClose, resources }: PrintLabelsModalProps) {
  const [pageSize, setPageSize] = useState("A4");
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(3);
  const [gap, setGap] = useState(8);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [title, setTitle] = useState("Company Resource");

  React.useEffect(() => {
    if (isOpen) {
      setSelectedCategory("all");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Print Labels</title>
          <style>
            body { margin: 0; padding: 0; font-family: sans-serif; height: 100%; }
            html { height: 100%; }
            @page { size: ${pageSize === "A4" ? "A4" : "letter"} portrait; margin: 0.5in; }
            .print-page { page-break-after: always; height: 100%; box-sizing: border-box; }
            .print-page:last-child { page-break-after: auto; }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 500);
    };
  };

  const getPageDimensions = () => {
    if (pageSize === "A4") return { width: "100%", aspectRatio: "1 / 1.414" };
    if (pageSize === "Letter") return { width: "100%", aspectRatio: "8.5 / 11" };
    return { width: "100%", aspectRatio: "1 / 1.414" };
  };

  const labelsPerPage = rows * cols;
  
  // Extract unique categories
  const categories = Array.from(new Set(resources.map(r => r.category).filter(Boolean)));
  
  // Filter resources
  const filteredResources = selectedCategory === "all" 
    ? resources 
    : resources.filter(r => r.category === selectedCategory);

  // Use actual resources, if none, use placeholders
  const displayResources = resources.length === 0 
    ? ["HK-XXX-001", "HK-XXX-002", "HK-XXX-003"]
    : filteredResources.map(r => r.assetId || "HK-XXX-000");

  // Create pages
  const pages = [];
  for (let i = 0; i < displayResources.length; i += labelsPerPage) {
    const pageLabels = displayResources.slice(i, i + labelsPerPage);
    // Pad the last page if needed for visual grid consistency
    while (pageLabels.length < labelsPerPage) {
      pageLabels.push("");
    }
    pages.push(pageLabels);
  }

  // If no pages, create at least one empty page with placeholders
  if (pages.length === 0) {
    const emptyPage = Array(labelsPerPage).fill("HK-XXX-000");
    pages.push(emptyPage);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden overflow-y-auto">

      {/* Modal Container */}
      <div className="bg-white border border-border rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] print:hidden">
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-brand-teal" />
              Print Resource Labels
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Configure layout and title for your asset labels. Total labels to print: {displayResources.length}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Controls */}
          <div className="p-6 w-full lg:w-80 border-r border-border overflow-y-auto space-y-6 flex-shrink-0">
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Page Size</label>
              <Select value={pageSize} onValueChange={setPageSize}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Page Size" />
                </SelectTrigger>
                <SelectContent className="z-[150]">
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="Letter">US Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Filter Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="z-[150]">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Rows</label>
                <Input 
                  type="number" 
                  min={1} 
                  max={30} 
                  value={rows} 
                  onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Columns</label>
                <Input 
                  type="number" 
                  min={1} 
                  max={15} 
                  value={cols} 
                  onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))} 
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-bold text-foreground">Spacing / Gap (px)</label>
                <Input 
                  type="number" 
                  min={0} 
                  max={50} 
                  value={gap} 
                  onChange={(e) => setGap(Math.max(0, parseInt(e.target.value) || 0))} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Label Title</label>
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="e.g. Property of Company" 
              />
            </div>
            
            <div className="pt-4 border-t border-border">
              <Button onClick={handlePrint} className="w-full bg-brand-teal hover:bg-brand-teal-light text-white font-medium shadow-sm">
                <Printer className="w-4 h-4 mr-2" />
                Print {displayResources.length} Labels
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 bg-gray-100 p-8 overflow-y-auto flex flex-col items-center gap-8">
            {pages.map((pageLabels, pageIdx) => (
              <div 
                key={pageIdx}
                className="bg-white shadow-md border border-gray-200 p-[2px]"
                style={{ 
                  ...getPageDimensions(),
                  maxWidth: "600px",
                  display: "grid",
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: `${gap}px`,
                }}
              >
                {pageLabels.map((id, index) => (
                  <div key={index} className="bg-white flex flex-col items-center justify-center p-2 text-center overflow-hidden border border-gray-300 border-dashed">
                    {id ? (
                      <>
                        <div className="font-bold text-[10px] sm:text-xs text-foreground break-words w-full px-1">{title}</div>
                        <div className="font-mono text-[10px] text-muted-foreground break-words w-full mt-1 px-1">{id}</div>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actual Printable Area (Hidden, used as template for iframe) */}
      <div id="print-area" className="hidden">
        {pages.map((pageLabels, pageIdx) => (
          <div key={pageIdx} className="print-page" style={{
            display: "grid",
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: `${gap}px`,
          }}>
            {pageLabels.map((id, index) => (
              <div key={index} style={{
                border: "1px dashed #ccc",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
                boxSizing: "border-box",
                visibility: id ? "visible" : "hidden",
                textAlign: "center",
                wordBreak: "break-word"
              }}>
                <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>{title}</div>
                <div style={{ fontFamily: "monospace", fontSize: "12px" }}>{id}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
