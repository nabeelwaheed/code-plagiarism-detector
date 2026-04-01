#include "expr_eval.h"

#include <stdio.h>
#include <string.h>

int main(int argc, char **argv) {
    char input[512];

    if (argc > 1) {
        double value;
        if (!eval_expression(argv[1], &value)) {
            fprintf(stderr, "Failed to evaluate expression: %s\n", argv[1]);
            return 1;
        }
        printf("%s = %.6f\n", argv[1], value);
        return 0;
    }

    puts("Enter infix expressions (blank line to quit):");
    while (1) {
        double value;
        size_t len;
        printf("> ");
        if (!fgets(input, sizeof(input), stdin)) {
            break;
        }

        len = strlen(input);
        if (len == 0 || (len == 1 && input[0] == '\n')) {
            break;
        }

        if (input[len - 1] == '\n') {
            input[len - 1] = '\0';
        }

        if (!eval_expression(input, &value)) {
            puts("Invalid expression.");
            continue;
        }

        printf("= %.6f\n", value);
    }

    return 0;
}
