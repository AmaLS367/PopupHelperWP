const PopupConfig = {
    global: {
        telegramUrl: "https://t.me/", // Default link for GitHub. Replace with your own channel or user.
        whatsappUrl: "https://api.whatsapp.com/", // Default link for GitHub. Replace in production.

        limits: {
            perSession: true,
            afterCloseDays: 3,
            afterClickDays: 30
        },

        ui: {
            buttonMinHeightPx: 44,
            uppercaseButtons: false,
            openLinksInNewTab: true,
            closeOnActionClick: true,
            colors: {
                telegram: "var(--brand-blue)",
                whatsapp: "var(--brand-green)"
            }
        },

        // Default triggers used if a page does not override them.
        triggersDefault: {
            desktop: {
                exitIntent: true,
                idleSeconds: 25,
                scrollPercent: 80
            },
            mobile: {
                backButton: true,
                idleSeconds: 10,
                scrollPercent: 40
            }
        },

        // Fallback content in case contentFile is missing or unreadable.
        contentDefault: {
            title: "Получите ВНЖ Digital Nomad без риска",
            subtitleLine1: "<strong>70%</strong> стоимости сопровождения оплачиваете только после одобрения ВНЖ.",
            noteSmall: "Отвечаем лично, без ботов. Поможем оценить ваш шанс на одобрение."
        }
    },

    pages: [
        {
            // Digital nomad page
            match: "/vnzh-cifrovogo-kochevnika/", // Example page path. Adjust to your site structure.
            contentFile: "digital_nomad.json"
        },
        {
            // Home page
            match: "/",
            contentFile: "home_es.json",
            fallbackContent: {
                title: "Получите ВНЖ в Испании без риска",
                subtitleLine1: "<strong>50%</strong> стоимости сопровождения оплачиваете только после одобрения ВНЖ!",
                noteSmall: "Отвечаем лично, без ботов. Поможем оценить ваши шансы на одобрение."
            }
        },
        {
            // No Lucrativa page
            match: "/vnzh-bez-prava-na-rabotu/", // Example page path. Adjust to your site structure.
            contentFile: "no_lucrativa.json",
            fallbackContent: {
                title: "Получите ВНЖ No Lucrativa без риска",
                subtitleLine1: "<strong>50%</strong> стоимости сопровождения оплачиваете только после одобрения ВНЖ!",
                noteSmall: "Отвечаем лично, без ботов. Поможем оценить ваши шансы на одобрение."
            }
        },
        {
            // Modificacion a cuenta propia
            match: "/modifikaciya-na-cuenta-propia/", // Example page path. Adjust to your site structure.
            contentFile: "home_es.json",
            fallbackContent: {
                title: "Получите ВНЖ в Испании без риска",
                subtitleLine1: "<strong>50%</strong> стоимости сопровождения оплачиваете только после одобрения ВНЖ!",
                noteSmall: "Отвечаем лично, без ботов. Поможем оценить ваши шансы на одобрение."
            }
        },
        {
            // Contacts
            match: "/kontakty/", // Example page path. Adjust to your site structure.
            contentFile: "home_es.json",
            fallbackContent: {
                title: "Получите ВНЖ в Испании без риска",
                subtitleLine1: "<strong>50%</strong> стоимости сопровождения оплачиваете только после одобрения ВНЖ!",
                noteSmall: "Отвечаем лично, без ботов. Поможем оценить ваши шансы на одобрение."
            }
        }
    ],

    fallback: {
        // Uses global defaults
    }
};
