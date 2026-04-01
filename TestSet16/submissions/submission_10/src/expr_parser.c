#include "expr_eval.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

static int precedence(char op) {
    if (op == '+' || op == '-') return 1;
    if (op == '*' || op == '/') return 2;
    return 0;
}

int infix_to_postfix(const char *expr, char *postfix_out, size_t out_size) {
    char stack[256];
    int top = -1;
    size_t out = 0;
    size_t i = 0;

    while (expr[i] != '\0') {
        char c = expr[i];

        if (isspace((unsigned char)c)) {
            i++;
            continue;
        }

        if (isdigit((unsigned char)c) || c == '.') {
            while (isdigit((unsigned char)expr[i]) || expr[i] == '.') {
                if (out + 2 >= out_size) {
                    return 0;
                }
                postfix_out[out++] = expr[i++];
            }
            postfix_out[out++] = ' ';
            continue;
        }

        if (c == '(') {
            if (top + 1 >= 256) {
                return 0;
            }
            stack[++top] = c;
            i++;
            continue;
        }

        if (c == ')') {
            while (top >= 0 && stack[top] != '(') {
                if (out + 3 >= out_size) {
                    return 0;
                }
                postfix_out[out++] = stack[top--];
                postfix_out[out++] = ' ';
            }
            if (top < 0 || stack[top] != '(') {
                return 0;
            }
            top--;
            i++;
            continue;
        }

        if (c == '+' || c == '-' || c == '*' || c == '/') {
            while (top >= 0 && precedence(stack[top]) >= precedence(c)) {
                if (out + 3 >= out_size) {
                    return 0;
                }
                postfix_out[out++] = stack[top--];
                postfix_out[out++] = ' ';
            }
            stack[++top] = c;
            i++;
            continue;
        }

        return 0;
    }

    while (top >= 0) {
        if (stack[top] == '(') {
            return 0;
        }
        if (out + 3 >= out_size) {
            return 0;
        }
        postfix_out[out++] = stack[top--];
        postfix_out[out++] = ' ';
    }

    postfix_out[out] = '\0';
    return 1;
}
