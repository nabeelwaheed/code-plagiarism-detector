#include "matrix_toolkit.hpp"

#include <iostream>

int main() {
    int ra, ca, rb, cb;

    std::cout << "Matrix Toolkit\n";
    std::cout << "Enter rows cols for A: ";
    std::cin >> ra >> ca;
    std::cout << "Enter matrix A values row-wise:\n";
    Matrix a = readMatrix(ra, ca);

    std::cout << "Enter rows cols for B: ";
    std::cin >> rb >> cb;
    std::cout << "Enter matrix B values row-wise:\n";
    Matrix b = readMatrix(rb, cb);

    try {
        if (ra == rb && ca == cb) {
            std::cout << "\nA + B:\n";
            printMatrix(add(a, b));
        } else {
            std::cout << "\nSkipping addition due to dimension mismatch\n";
        }

        if (ca == rb) {
            std::cout << "\nA * B:\n";
            printMatrix(multiply(a, b));
        } else {
            std::cout << "\nSkipping multiplication due to dimension mismatch\n";
        }

        std::cout << "\nTranspose of A:\n";
        printMatrix(transpose(a));

        if (ra == ca) {
            std::cout << "\nTrace of A: " << trace(a) << '\n';
        }
    } catch (const std::exception &ex) {
        std::cerr << "Error: " << ex.what() << '\n';
        return 1;
    }

    return 0;
}
