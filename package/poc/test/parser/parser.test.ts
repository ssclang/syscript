import { expect, test } from 'vitest';
import { parse } from '~/parser/parser.js';

test('variable declaration', () => {
  expect(parse('val a = 7')).toMatchInlineSnapshot(`
    NodeSourceFile {
      "span": {
        "end": 9,
        "start": 0,
      },
      "statements": [
        NodeVariableDeclarationStatement {
          "keyword": "val",
          "reference": NodeVariableReferenceExpression {
            "identifier": NodeIdentifier {
              "name": "a",
              "span": {
                "end": 5,
                "start": 4,
              },
            },
            "span": {
              "end": 5,
              "start": 4,
            },
          },
          "span": {
            "end": 9,
            "start": 0,
          },
          "value": NodeNumberLiteralExpression {
            "span": {
              "end": 9,
              "start": 8,
            },
            "value": "7",
          },
        },
      ],
    }
  `);
});

test('assignment', () => {
  expect(parse('count = count + 2')).toMatchInlineSnapshot(`
    NodeSourceFile {
      "span": {
        "end": 17,
        "start": 0,
      },
      "statements": [
        NodeAssignmentStatement {
          "reference": NodeVariableReferenceExpression {
            "identifier": NodeIdentifier {
              "name": "count",
              "span": {
                "end": 5,
                "start": 0,
              },
            },
            "span": {
              "end": 5,
              "start": 0,
            },
          },
          "span": {
            "end": 17,
            "start": 0,
          },
          "value": NodeBinaryExpression {
            "left": NodeVariableReferenceExpression {
              "identifier": NodeIdentifier {
                "name": "count",
                "span": {
                  "end": 13,
                  "start": 8,
                },
              },
              "span": {
                "end": 13,
                "start": 8,
              },
            },
            "operator": "+",
            "right": NodeNumberLiteralExpression {
              "span": {
                "end": 17,
                "start": 16,
              },
              "value": "2",
            },
            "span": {
              "end": 17,
              "start": 8,
            },
          },
        },
      ],
    }
  `);
});

test('precedence', () => {
  expect(parse('std.out(count + 2 * 3)')).toMatchInlineSnapshot(`
    NodeSourceFile {
      "span": {
        "end": 22,
        "start": 0,
      },
      "statements": [
        NodeExpressionStatement {
          "expression": NodeCallExpression {
            "arguments": [
              NodeBinaryExpression {
                "left": NodeVariableReferenceExpression {
                  "identifier": NodeIdentifier {
                    "name": "count",
                    "span": {
                      "end": 13,
                      "start": 8,
                    },
                  },
                  "span": {
                    "end": 13,
                    "start": 8,
                  },
                },
                "operator": "+",
                "right": NodeBinaryExpression {
                  "left": NodeNumberLiteralExpression {
                    "span": {
                      "end": 17,
                      "start": 16,
                    },
                    "value": "2",
                  },
                  "operator": "*",
                  "right": NodeNumberLiteralExpression {
                    "span": {
                      "end": 21,
                      "start": 20,
                    },
                    "value": "3",
                  },
                  "span": {
                    "end": 21,
                    "start": 16,
                  },
                },
                "span": {
                  "end": 21,
                  "start": 8,
                },
              },
            ],
            "callee": NodeMemberExpression {
              "identifier": NodeIdentifier {
                "name": "out",
                "span": {
                  "end": 7,
                  "start": 4,
                },
              },
              "object": NodeVariableReferenceExpression {
                "identifier": NodeIdentifier {
                  "name": "std",
                  "span": {
                    "end": 3,
                    "start": 0,
                  },
                },
                "span": {
                  "end": 3,
                  "start": 0,
                },
              },
              "span": {
                "end": 7,
                "start": 0,
              },
            },
            "span": {
              "end": 22,
              "start": 0,
            },
          },
          "span": {
            "end": 22,
            "start": 0,
          },
        },
      ],
    }
  `);
});

test('function with block body', () => {
  expect(parse('val main = fn () {\n  val a = 7\n  a\n}')).toMatchInlineSnapshot(`
    NodeSourceFile {
      "span": {
        "end": 36,
        "start": 0,
      },
      "statements": [
        NodeVariableDeclarationStatement {
          "keyword": "val",
          "reference": NodeVariableReferenceExpression {
            "identifier": NodeIdentifier {
              "name": "main",
              "span": {
                "end": 8,
                "start": 4,
              },
            },
            "span": {
              "end": 8,
              "start": 4,
            },
          },
          "span": {
            "end": 36,
            "start": 0,
          },
          "value": NodeFunctionExpression {
            "body": NodeBlockExpression {
              "span": {
                "end": 36,
                "start": 17,
              },
              "statements": [
                NodeVariableDeclarationStatement {
                  "keyword": "val",
                  "reference": NodeVariableReferenceExpression {
                    "identifier": NodeIdentifier {
                      "name": "a",
                      "span": {
                        "end": 26,
                        "start": 25,
                      },
                    },
                    "span": {
                      "end": 26,
                      "start": 25,
                    },
                  },
                  "span": {
                    "end": 30,
                    "start": 21,
                  },
                  "value": NodeNumberLiteralExpression {
                    "span": {
                      "end": 30,
                      "start": 29,
                    },
                    "value": "7",
                  },
                },
                NodeExpressionStatement {
                  "expression": NodeVariableReferenceExpression {
                    "identifier": NodeIdentifier {
                      "name": "a",
                      "span": {
                        "end": 34,
                        "start": 33,
                      },
                    },
                    "span": {
                      "end": 34,
                      "start": 33,
                    },
                  },
                  "span": {
                    "end": 34,
                    "start": 33,
                  },
                },
              ],
            },
            "span": {
              "end": 36,
              "start": 11,
            },
          },
        },
      ],
    }
  `);
});
