#include "expr_eval.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int eval_postfix(const char *postfix, double *result_out) {
    double stack[256];
    int top = -1;
    char buffer[512];
    char *token;

    strncpy(buffer, postfix, sizeof(buffer) - 1U);
    buffer[sizeof(buffer) - 1U] = '\0';

    token = strtok(buffer, " ");
    while (token) {
        if ((token[0] >= '0' && token[0] <= '9') || token[0] == '.') {
            if (top + 1 >= 256) {
                return 0;
            }
            stack[++top] = atof(token);
        } else if (strlen(token) == 1 && strchr("+-*/", token[0])) {
            double b;
            double a;
            double r;
            if (top < 1) {
                return 0;
            }
            b = stack[top--];
            a = stack[top--];

            switch (token[0]) {
                case '+': r = a + b; break;
                case '-': r = a - b; break;
                case '*': r = a * b; break;
                case '/':
                    if (b == 0.0) {
                        return 0;
                    }
                    r = a / b;
                    break;
                default:
                    return 0;
            }

            stack[++top] = r;
        } else {
            return 0;
        }

        token = strtok(NULL, " ");
    }

    if (top != 0) {
        return 0;
    }

    *result_out = stack[top];
    return 1;
}

int eval_expression(const char *expr, double *result_out) {
    char postfix[1024];
    if (!infix_to_postfix(expr, postfix, sizeof(postfix))) {
        return 0;
    }

    return eval_postfix(postfix, result_out);
}
