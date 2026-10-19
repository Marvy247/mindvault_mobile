import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";

import { ScannerScreen } from "./ScannerScreen";
import { ThemeProvider } from "../theme/ThemeProvider";

type BarcodeScannedHandler = (args: { data: string }) => void;

const barcodeScannedHandlers = new Set<BarcodeScannedHandler>();

jest.mock("expo-camera", () => ({
  CameraView: (props: { onBarcodeScanned?: BarcodeScannedHandler }) => {
    if (props.onBarcodeScanned) {
      barcodeScannedHandlers.add(props.onBarcodeScanned);
    }
    return null;
  },
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
  __simulateBarcodeScan: (data: string) => {
    for (const handler of barcodeScannedHandlers) {
      handler({ data });
    }
  },
  __clearBarcodeScannedHandlers: () => {
    barcodeScannedHandlers.clear();
  },
}));

jest.mock("expo-clipboard", () => ({
  getStringAsync: jest.fn().mockResolvedValue(""),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  return {
    ...actual,
    Linking: {
      openURL: jest.fn().mockResolvedValue(undefined),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  };
});

const { Linking: MockLinking } = jest.requireMock("react-native");
const {
  __simulateBarcodeScan: simulateBarcodeScan,
  __clearBarcodeScannedHandlers: clearBarcodeScannedHandlers,
} = jest.requireMock("expo-camera");

const navigation = {
  replace: jest.fn(),
  goBack: jest.fn(),
} as any;

function renderScreen(permission = { granted: true }) {
  (jest.requireMock("expo-camera").useCameraPermissions as jest.Mock).mockReturnValue([
    permission,
    jest.fn(),
  ]);

  return render(
    <ThemeProvider>
      <ScannerScreen navigation={navigation} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  clearBarcodeScannedHandlers();
  MockLinking.openURL.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ScannerScreen interaction tests", () => {
  it("navigates to ResourceDetail for a valid resource scan", () => {
    const screen = renderScreen();

    simulateBarcodeScan("mindvault://resources/abc123");

    expect(navigation.replace).toHaveBeenCalledWith("ResourceDetail", {
      resourceId: "abc123",
    });
  });

  it("shows a retry timer for an unknown QR code and clears it", () => {
    jest.useFakeTimers();
    const screen = renderScreen();

    simulateBarcodeScan("not-a-resource");

    expect(
      screen.getByText(
        "Unrecognized QR code. Point at a MindVault resource code.",
      ),
    ).toBeTruthy();

    jest.advanceTimersByTime(2500);

    expect(screen.queryByText("Unrecognized QR code.")).toBeFalsy();
  });

  it("does not leak the retry timer on unmount", () => {
    jest.useFakeTimers();
    const screen = renderScreen();

    simulateBarcodeScan("not-a-resource");

    screen.unmount();

    jest.advanceTimersByTime(2500);
    expect(screen.queryByText("Unrecognized QR code.")).toBeFalsy();
  });

  it("prompts to open an external URL for http(s) scans", () => {
    const screen = renderScreen();

    simulateBarcodeScan("https://example.com");

    expect(MockLinking.openURL).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Open"));

    expect(MockLinking.openURL).toHaveBeenCalledWith("https://example.com");
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it("cancels the external URL prompt without opening", () => {
    const screen = renderScreen();

    simulateBarcodeScan("https://example.com");

    fireEvent.press(screen.getByText("Cancel"));

    expect(MockLinking.openURL).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("navigates for a valid pasted resource link", () => {
    (jest.requireMock("expo-clipboard").getStringAsync as jest.Mock).mockResolvedValueOnce(
      "mindvault://resources/xyz",
    );

    const screen = renderScreen();

    fireEvent.press(screen.getByText("Paste Link Instead"));
    fireEvent.press(screen.getByText("Paste from Clipboard"));
    fireEvent.press(screen.getByText("Go"));

    expect(navigation.replace).toHaveBeenCalledWith("ResourceDetail", {
      resourceId: "xyz",
    });
  });

  it("shows an error for an invalid pasted link", () => {
    const screen = renderScreen();

    fireEvent.press(screen.getByText("Paste Link Instead"));
    fireEvent.changeText(
      screen.getByPlaceholderText("https://mindvault.app/resources/…"),
      "not-a-resource-link",
    );
    fireEvent.press(screen.getByText("Go"));

    expect(
      screen.getByText(
        "This doesn't look like a valid MindVault resource URL.",
      ),
    ).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("shows the grant-permission screen when camera is denied", () => {
    jest.useFakeTimers();
    const screen = renderScreen({ granted: false, status: "undetermined" as any });

    expect(screen.getByText("Camera access is required")).toBeTruthy();
    expect(screen.getByText("Grant Permission")).toBeTruthy();

    fireEvent.press(screen.getByText("Grant Permission"));

    expect(screen.getByText("Requesting camera permission…")).toBeTruthy();
  });

  it("opens the paste modal", () => {
    const screen = renderScreen();

    fireEvent.press(screen.getByText("Paste Link Instead"));

    expect(screen.getByText("Enter Resource Link")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("https://mindvault.app/resources/…"),
    ).toBeTruthy();
  });
});
