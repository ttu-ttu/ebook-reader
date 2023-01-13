/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import type { BooksDbBookData } from '$lib/data/database/books-db/versions/books-db';
import parseCss from '../css-parser/css-parser';
import stringifyCss from '../css-parser/css-stringify';
import type { Declaration, Rule } from '../css-parser/types';

const htmlRegex = /\s?html\s?/gi;
const bodyRegex = /\s?body\s?/gi;

export default function formatStyleSheet(bookData: BooksDbBookData, parentSelector: string) {
  const cssTree = parseCss(bookData.styleSheet);

  const newRules = cssTree.stylesheet.rules
    .filter((r) => r.type === 'rule')
    .filter((r) => !r.selectors.some((s) => htmlRegex.test(s) || bodyRegex.test(s)));

  newRules.forEach((rule) => {
    const newDeclarations: Record<string, string> = {};

    // eslint-disable-next-line no-param-reassign
    rule.declarations = rule.declarations.filter(
      (d) => !/line-height$/.test(d.property) && !/text-indent$/.test(d.property)
    );

    const lineBreakFormatter = new LineBreakFormatter(rule.declarations, newDeclarations);

    rule.declarations.forEach((declaration) => {
      assignKeyValToObj(newDeclarations, convertPrefixedDeclaration(declaration));
      assignKeyValToObj(newDeclarations, convertFontFamily(declaration));
      assignKeyValToObj(newDeclarations, lineBreakFormatter.convert(declaration));
      // Might also want to handle margin conversion
    });

    Object.entries(newDeclarations).forEach(([property, value]) => {
      rule.declarations.push({
        type: 'declaration',
        property,
        value
      });
    });

    // eslint-disable-next-line no-param-reassign
    rule.declarations = rule.declarations.filter((d) => !/writing-mode\s*$/.test(d.property));
  });

  newRules.push(getGeckoBrSolutionRule());

  newRules.forEach((rule) => {
    // eslint-disable-next-line no-param-reassign
    rule.selectors = encapsulatedSelectors(rule.selectors, parentSelector);
  });

  return stringifyCss({
    stylesheet: {
      rules: newRules
    },
    type: 'stylesheet'
  });
}

function encapsulatedSelectors(selectors: string[], parentSelector: string) {
  return selectors.map((selector) => `${parentSelector} ${selector}`);
}

function assignKeyValToObj(
  obj: Record<string, string>,
  keyValObj:
    | {
        key: string;
        value: string;
      }
    | undefined
) {
  if (keyValObj) {
    // eslint-disable-next-line no-param-reassign
    obj[keyValObj.key] = keyValObj.value;
  }
  return obj;
}

function convertPrefixedDeclaration(declaration: Declaration) {
  const regexResult = /(?:(?:-epub-)|(?:-webkit-))(.+)/i.exec(declaration.property);
  if (regexResult) {
    return {
      key: regexResult[1],
      value: declaration.value
    };
  }
  return undefined;
}

function convertFontFamily(declaration: Declaration) {
  if (declaration.property === 'font-family') {
    let newValue: string = declaration.value;
    if (newValue.includes('sans-serif')) {
      newValue = `var(--font-family-sans-serif, Noto Sans JP, sans-serif)`;
    } else if (newValue.includes('serif')) {
      newValue = `var(--font-family-serif, Noto Serif JP, serif)`;
    }
    return {
      key: declaration.property,
      value: newValue
    };
  }
  return undefined;
}

class LineBreakFormatter {
  private hasLineBreakDefined?: boolean | undefined;

  constructor(
    private ruleDeclarations: Declaration[],
    private newDeclarations: Readonly<Record<string, string>>
  ) {}

  convert(declaration: Declaration) {
    if (
      /(?:(?:-epub-)|(?:-webkit-))?word-break$/i.exec(declaration.property) &&
      declaration.value === 'break-all'
    ) {
      if (this.hasLineBreakDefined === undefined) {
        this.hasLineBreakDefined = this.ruleDeclarations.some(
          (d) => d.type === 'declaration' && d.property === 'line-break'
        );
      }
      if (!this.hasLineBreakDefined && !this.newDeclarations['line-break']) {
        // to allow breaks one long string of periods
        return {
          key: 'line-break',
          value: 'loose'
        };
      }
    }
    return undefined;
  }
}

function getGeckoBrSolutionRule(): Rule {
  // <br> + display: block makes it line-height: 0 on Firefox, when it creates space on Chrome (regardless of display value)
  return {
    type: 'rule',
    selectors: ['br'],
    declarations: [
      {
        type: 'declaration',
        property: 'display',
        value: 'inline!important'
      }
    ]
  };
}
